import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Stage, Layer, Line, Text } from 'react-konva';
import { ArrowLeft, Pen, Eraser, CheckCircle, MessageSquare, Loader2 } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import html2canvas from 'html2canvas';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import AIChat from './AIChat';
import localforage from 'localforage';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function PaperViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [paper, setPaper] = useState<any>(null);
  const [pdfFile, setPdfFile] = useState<any>(null);
  
  // Drawing state
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [lines, setLines] = useState<any[]>([]);
  const [aiAnnotations, setAiAnnotations] = useState<any[]>([]);
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // AI state
  const [showChat, setShowChat] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markingProgress, setMarkingProgress] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Use the parent container's width, but cap it at 800px for readability
        const width = containerRef.current.parentElement?.clientWidth || 800;
        // Subtract padding (32px * 2 = 64px)
        setContainerWidth(Math.min(width - 64, 800));
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const scale = containerWidth / 800;
  const stageHeight = 1131 * scale;

  useEffect(() => {
    const fetchPaper = async () => {
      if (!id || !user) return;
      const docRef = doc(db, 'user_papers', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPaper(data);
        
        if (data.fileUrl === 'local') {
          const file = await localforage.getItem(`paper_${id}`);
          if (file) {
            setPdfFile(file);
          } else {
            alert("Could not find the local PDF file. It may have been cleared from your browser.");
          }
        } else {
          setPdfFile(data.fileUrl);
        }

        if (data.annotations) {
          try {
            setLines(JSON.parse(data.annotations));
          } catch (e) {
            console.error("Failed to parse annotations");
          }
        }
        
        if (data.aiAnnotations) {
          try {
            setAiAnnotations(JSON.parse(data.aiAnnotations));
          } catch (e) {
            console.error("Failed to parse AI annotations");
          }
        }
      }
    };
    fetchPaper();
  }, [id, user]);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    // Adjust for scale
    const x = pos.x / scale;
    const y = pos.y / scale;
    setLines([...lines, { tool, points: [x, y], page: pageNumber }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const x = pos.x / scale;
    const y = pos.y / scale;
    
    let lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([x, y]);
    
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
    saveAnnotations();
  };

  const saveAnnotations = async () => {
    if (!id) return;
    const docRef = doc(db, 'user_papers', id);
    await updateDoc(docRef, {
      annotations: JSON.stringify(lines),
      updatedAt: new Date().toISOString()
    });
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const handleMarkPaper = async () => {
    if (!containerRef.current || !id || !user) return;
    setMarking(true);
    setMarkingProgress('Analyzing page...');
    setFeedback(null);

    try {
      // Capture the current view (PDF + Annotations)
      const canvas = await html2canvas(containerRef.current, { scale: 1.5, useCORS: true });
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: `You are an expert examiner marking a student's past paper. Analyze the provided image, which contains the original exam paper and the student's handwritten answers (drawn over it). 
            
            Assume the paper's coordinate system is exactly 800 pixels wide and 1131 pixels high.
            
            Please provide:
            1. A score out of the total possible marks for this page (e.g., "4/5" or "15/20").
            2. Detailed feedback on what they did right and wrong.
            3. An array of "corrections" to be written directly on the paper. 
               - Include the marks for each question next to the question (e.g., "4/5").
               - Provide short text corrections (e.g., "Missing units", "Formula error").
               - Provide exact x and y coordinates. IMPORTANT: x MUST be between 50 and 550 (to leave room for text wrapping), and y MUST be between 50 and 1080.
               - Use "red" for mistakes/deductions and "green" for correct parts/full marks.
            
            Format your response as JSON with keys: 
            "score" (string, e.g., "15/20"), 
            "feedback" (string, markdown formatted), 
            "corrections" (array of objects with "text" (string), "x" (number), "y" (number), "color" (string))` },
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      setFeedback(result.feedback);
      
      // Process AI annotations
      const newAnnotations = result.corrections ? result.corrections.map((c: any) => ({
        ...c, 
        x: clamp(c.x, 20, 550), // Clamp x to max 550 to ensure at least 250px width for text
        y: clamp(c.y, 20, 1100),
        page: pageNumber,
        fontSize: 18
      })) : [];
      
      // Add the score at the top right if provided
      if (result.score) {
        newAnnotations.push({
          text: `Score: ${result.score}`,
          x: 550,
          y: 50,
          color: 'red',
          fontSize: 24,
          page: pageNumber,
          fontStyle: 'bold'
        });
      }

      const updatedAiAnnotations = [
        ...aiAnnotations.filter(a => a.page !== pageNumber), 
        ...newAnnotations
      ];
      
      setAiAnnotations(updatedAiAnnotations);
      
      // Update score and annotations in DB
      const docRef = doc(db, 'user_papers', id);
      await updateDoc(docRef, {
        score: result.score || paper.score || 0,
        status: 'completed',
        aiAnnotations: JSON.stringify(updatedAiAnnotations),
        updatedAt: new Date().toISOString()
      });
      
      // Update user's total papers completed if this is the first time it's marked
      if (paper.status !== 'completed' && result.score !== undefined) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            papersCompleted: (userSnap.data().papersCompleted || 0) + 1
          });
        }
      }
    } catch (error: any) {
      console.error("Error marking paper:", error);
      alert("Failed to mark paper: " + (error?.message || JSON.stringify(error) || "Unknown error"));
    } finally {
      setMarking(false);
      setMarkingProgress('');
    }
  };

  const handleMarkWholePaper = async () => {
    if (!containerRef.current || !id || !user || !numPages) return;
    setMarking(true);
    setFeedback(null);

    try {
      const images = [];
      
      // 1. Capture all pages sequentially
      for (let i = 1; i <= numPages; i++) {
        setMarkingProgress(`Scanning page ${i} of ${numPages}...`);
        setPageNumber(i);
        
        // Wait for react-pdf to render the new page and konva to update
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (containerRef.current) {
          const canvas = await html2canvas(containerRef.current, { scale: 1.2, useCORS: true });
          const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
          images.push({
            inlineData: { data: base64Image, mimeType: 'image/jpeg' }
          });
        }
      }

      setMarkingProgress(`AI is analyzing the entire paper...`);

      const prompt = `You are an expert examiner marking a student's past paper. I am providing images of all ${numPages} pages of the exam paper, in order. The student's handwritten answers are drawn over the original paper.

      Assume each page's coordinate system is exactly 800 pixels wide and 1131 pixels high.

      Please provide:
      1. A total score for the entire paper. You MUST calculate the total marks scored and the total possible marks for the entire paper. Format this EXACTLY as "Scored/Total" (e.g., "45/80" or "85/100").
      2. Overall feedback for the entire paper.
      3. For EACH page, an array of "corrections" to be written directly on the paper. 
         - Include the marks for each question next to the question (e.g., "4/5").
         - Provide short text corrections (e.g., "Missing units", "Formula error"). Keep them concise.
         - Provide exact x and y coordinates. IMPORTANT: x MUST be between 50 and 550 (to leave room for text wrapping), and y MUST be between 50 and 1080.
         - Use "red" for mistakes/deductions and "green" for correct parts/full marks.

      Format your response as JSON:
      {
        "totalScore": "85/100",
        "overallFeedback": "string",
        "pages": [
          {
            "pageNumber": 1,
            "corrections": [
              { "text": "string", "x": number, "y": number, "color": "string" }
            ]
          }
        ]
      }`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: prompt },
            ...images
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      setFeedback(result.overallFeedback);
      
      let allNewAnnotations: any[] = [];
      
      if (result.pages) {
        result.pages.forEach((p: any) => {
          if (p.corrections) {
            const pageAnns = p.corrections.map((c: any) => ({
              ...c,
              x: clamp(c.x, 20, 550),
              y: clamp(c.y, 20, 1100),
              page: p.pageNumber,
              fontSize: 18
            }));
            allNewAnnotations = [...allNewAnnotations, ...pageAnns];
          }
        });
      }

      // Add total score to page 1 prominently
      if (result.totalScore) {
        allNewAnnotations.push({
          text: `Total Score: ${result.totalScore}`,
          x: 400,
          y: 50,
          color: 'red',
          fontSize: 36,
          page: 1,
          fontStyle: 'bold'
        });
      }

      setAiAnnotations(allNewAnnotations);
      
      // Update DB
      const docRef = doc(db, 'user_papers', id);
      const numericScore = parseInt(result.totalScore?.split('/')[0]) || paper.score || 0;
      
      await updateDoc(docRef, {
        score: numericScore,
        status: 'completed',
        aiAnnotations: JSON.stringify(allNewAnnotations),
        updatedAt: new Date().toISOString()
      });
      
      // Update user stats
      if (paper.status !== 'completed') {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            papersCompleted: (userSnap.data().papersCompleted || 0) + 1
          });
        }
      }

      // Go back to page 1 to show the total score
      setPageNumber(1);

    } catch (error: any) {
      console.error("Error marking whole paper:", error);
      alert("Failed to mark the whole paper: " + (error?.message || JSON.stringify(error) || "Unknown error"));
    } finally {
      setMarking(false);
      setMarkingProgress('');
    }
  };

  if (!paper) return <div className="p-8">Loading paper...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F7] dark:bg-[#0A0A0A] relative font-sans transition-colors duration-300">
      {/* Top Bar */}
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm z-30 relative">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2.5 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full transition-all shadow-sm active:scale-95 border border-gray-200/50 dark:border-gray-700/50">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white truncate max-w-[200px] md:max-w-md">{paper.title}</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-200/50 dark:bg-gray-800/50 p-1.5 rounded-2xl hidden sm:flex backdrop-blur-sm">
          <button 
            onClick={() => setTool('pen')}
            className={`p-2.5 rounded-xl transition-all ${tool === 'pen' ? 'bg-white dark:bg-gray-700 shadow-md text-indigo-500 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
          >
            <Pen className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setTool('eraser')}
            className={`p-2.5 rounded-xl transition-all ${tool === 'eraser' ? 'bg-white dark:bg-gray-700 shadow-md text-indigo-500 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
          >
            <Eraser className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowChat(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 text-indigo-500 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm transition-all font-semibold shadow-[0_2px_10px_rgb(0,0,0,0.02)] active:scale-95 text-sm md:text-base"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:inline">AI Help</span>
          </button>
          <button 
            onClick={handleMarkPaper}
            disabled={marking}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-all font-semibold shadow-md shadow-indigo-500/25 active:scale-95 text-sm md:text-base"
          >
            {marking && !markingProgress.includes('Scanning') ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            <span className="hidden md:inline">{marking && !markingProgress.includes('Scanning') ? 'Marking...' : 'Mark Page'}</span>
            <span className="md:hidden">Mark</span>
          </button>
          {numPages && pageNumber === numPages && (
            <button 
              onClick={handleMarkWholePaper}
              disabled={marking}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all font-semibold shadow-md shadow-emerald-500/25 active:scale-95 text-sm md:text-base"
            >
              {marking && markingProgress.includes('Scanning') ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              <span className="hidden md:inline">{marking && markingProgress.includes('Scanning') ? 'Scanning...' : 'Mark Whole Paper'}</span>
              <span className="md:hidden">Mark All</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Tools (visible only on small screens) */}
      <div className="sm:hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 p-3 flex justify-center gap-3 z-20 sticky top-0">
        <button 
          onClick={() => setTool('pen')}
          className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${tool === 'pen' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
        >
          <Pen className="w-4 h-4" /> Pen
        </button>
        <button 
          onClick={() => setTool('eraser')}
          className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${tool === 'eraser' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
        >
          <Eraser className="w-4 h-4" /> Eraser
        </button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-auto flex flex-col items-center p-4 md:p-8 relative">
        {markingProgress && (
          <div className="absolute inset-0 z-50 bg-white/40 dark:bg-gray-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-10 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] flex flex-col items-center max-w-sm text-center border border-white dark:border-gray-700">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-inner dark:shadow-none">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">AI is working</h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium">{markingProgress}</p>
            </div>
          </div>
        )}
        
        <div className="flex flex-col xl:flex-row gap-8 items-start w-full max-w-[1200px] justify-center">
          <div className="flex-1 w-full flex justify-center">
            <div ref={containerRef} className="relative shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white rounded-xl overflow-hidden border border-gray-200/50" style={{ width: containerWidth, height: stageHeight }}>
              {pdfFile && (
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  className="absolute inset-0 bg-white"
                >
                  <Page 
                    pageNumber={pageNumber} 
                    width={containerWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              )}
              
              <div className="absolute inset-0 z-10">
                <Stage
                  width={containerWidth}
                  height={stageHeight}
                  scaleX={scale}
                  scaleY={scale}
                  onMouseDown={handleMouseDown}
                  onMousemove={handleMouseMove}
                  onMouseup={handleMouseUp}
                  onTouchStart={handleMouseDown}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
                  ref={stageRef}
                >
                  <Layer>
                    {lines.filter(l => l.page === pageNumber || !l.page).map((line, i) => (
                      <Line
                        key={i}
                        points={line.points}
                        stroke={line.tool === 'eraser' ? 'white' : '#000000'}
                        strokeWidth={line.tool === 'eraser' ? 20 : 3}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        globalCompositeOperation={
                          line.tool === 'eraser' ? 'destination-out' : 'source-over'
                        }
                      />
                    ))}
                    {aiAnnotations.filter(a => a.page === pageNumber).map((ann, i) => (
                      <Text
                        key={`ai-${i}`}
                        x={ann.x}
                        y={ann.y}
                        text={ann.text}
                        fontSize={ann.fontSize || 16}
                        fill={ann.color || '#EF4444'}
                        fontFamily="Inter, sans-serif"
                        fontStyle="600"
                        width={800 - ann.x - 20}
                        wrap="word"
                      />
                    ))}
                  </Layer>
                </Stage>
              </div>
            </div>
          </div>

          {/* Feedback Panel */}
          {feedback && (
            <div className="w-full xl:w-80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-white dark:border-gray-800 p-6 xl:sticky xl:top-8 shrink-0">
              <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-1.5 rounded-xl">
                  <CheckCircle className="w-5 h-5" />
                </div>
                AI Feedback
              </h3>
              <div className="prose prose-sm max-w-none prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-headings:text-gray-900 dark:prose-headings:text-white prose-strong:text-gray-900 dark:prose-strong:text-white">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{feedback}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Pagination */}
      {numPages && numPages > 1 && (
        <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 p-4 flex justify-center items-center gap-6 z-20 pb-safe">
          <button 
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(p => p - 1)}
            className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 rounded-xl disabled:opacity-50 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm active:scale-95"
          >
            Previous
          </button>
          <span className="font-semibold text-gray-600 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 px-4 py-2 rounded-xl backdrop-blur-sm">Page {pageNumber} of {numPages}</span>
          <button 
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber(p => p + 1)}
            className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 rounded-xl disabled:opacity-50 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm active:scale-95"
          >
            Next
          </button>
        </div>
      )}

      {/* AI Chat Sidebar */}
      {showChat && (
        <AIChat 
          onClose={() => setShowChat(false)} 
          paperContext={`Paper Title: ${paper.title}, Current Page: ${pageNumber}`} 
          onCaptureScreenshot={async () => {
            if (!containerRef.current) return null;
            try {
              const canvas = await html2canvas(containerRef.current, { scale: 1 });
              return canvas.toDataURL('image/jpeg').split(',')[1];
            } catch (err) {
              console.error('Failed to capture screenshot', err);
              return null;
            }
          }}
        />
      )}
    </div>
  );
}
