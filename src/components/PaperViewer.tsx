import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Stage, Layer, Line, Text } from 'react-konva';
import { ArrowLeft, Pen, Eraser, Highlighter, Circle, MessageSquare, Loader2, Minus, MousePointer2, CheckCircle, PenTool } from 'lucide-react';
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
import { motion } from 'motion/react';
import localforage from 'localforage';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const ZenoLoading = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => prev + (100 - prev) / 2);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-48 h-1.5 bg-gray-800 dark:bg-gray-800/50 rounded-full overflow-hidden mt-6 relative shadow-inner">
      <motion.div 
        className="h-full bg-white dark:bg-white/90"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: "linear" }}
      />
    </div>
  );
};

export default function PaperViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [paper, setPaper] = useState<any>(null);
  const [pdfFile, setPdfFile] = useState<any>(null);
  
  // Drawing state
  const [tool, setTool] = useState<'pen' | 'eraser' | 'highlighter' | 'select'>('select');
  const [pencilOnly, setPencilOnly] = useState(false);
  const [penColor, setPenColor] = useState<string>('#000000');
  const [penSize, setPenSize] = useState<number>(3);
  const [eraserSize, setEraserSize] = useState<number>(20);
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

  const captureWorkspaceScreenshot = async (customScale = 1.2): Promise<string | null> => {
    if (!containerRef.current) return null;
    try {
      const pdfCanvas = containerRef.current.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement 
        || containerRef.current.querySelector('canvas') as HTMLCanvasElement;
        
      if (pdfCanvas) {
        // Create a merged canvas
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = pdfCanvas.width;
        mergedCanvas.height = pdfCanvas.height;
        const ctx = mergedCanvas.getContext('2d');
        if (ctx) {
          // 1. Draw the PDF canvas
          ctx.drawImage(pdfCanvas, 0, 0);
          
          // 2. Draw the Konva stage canvas if it exists
          if (stageRef.current) {
            // Match the Konva canvas size to the PDF canvas size exactly
            const pixelRatio = pdfCanvas.width / containerWidth;
            const konvaCanvas = stageRef.current.toCanvas({ pixelRatio });
            if (konvaCanvas) {
              ctx.drawImage(konvaCanvas, 0, 0);
            }
          }
          
          return mergedCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        }
      }
      
      // Fallback to html2canvas if pdfCanvas was not found
      const canvas = await html2canvas(containerRef.current, { 
        scale: customScale, 
        useCORS: true, 
        logging: false 
      });
      return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    } catch (err) {
      console.error('Failed to capture screenshot', err);
      return null;
    }
  };

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

  const handlePointerDown = (e: any) => {
    if (tool === 'select') return;
    
    // Ignore touch events if pencilOnly is enabled (allow finger scrolling)
    if (pencilOnly && e.evt.pointerType === 'touch') return;
    
    const isEraserEvent = e.evt.pointerType === 'eraser' || (e.evt.button === 5);
    const activeTool = isEraserEvent ? 'eraser' : tool;
    
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    const x = pos.x / scale;
    const y = pos.y / scale;
    
    let currentSize = activeTool === 'eraser' ? eraserSize : penSize;
    let currentColor = penColor;
    
    if (activeTool === 'highlighter') {
      currentSize = penSize * 4;
      currentColor = penColor + '80'; // 50% opacity
    }

    setLines([...lines, { 
      tool: activeTool, 
      points: [x, y], 
      page: pageNumber,
      color: currentColor,
      size: currentSize
    }]);
  };

  const handlePointerMove = (e: any) => {
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

  const handlePointerUp = () => {
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

  const parseScoreToPercent = (scoreStr: any): number => {
    if (!scoreStr) return 0;
    if (typeof scoreStr === 'number') return scoreStr;
    
    const str = String(scoreStr).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      const scored = parseFloat(parts[0]);
      const total = parseFloat(parts[1]);
      if (!isNaN(scored) && !isNaN(total) && total > 0) {
        return Math.round((scored / total) * 100);
      }
    }
    
    const parsed = parseInt(str);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleMarkPaper = async () => {
    if (!containerRef.current || !id || !user) return;
    setMarking(true);
    setMarkingProgress('Analyzing page...');
    setFeedback(null);

    try {
      const ai = getAiClient();
      if (!ai) {
        setFeedback("AI capabilities are currently disabled. Please add a GEMINI_API_KEY environment variable in Vercel.");
        setMarkingProgress(null);
        return;
      }

      // Capture the current view (PDF + Annotations)
      const base64Image = await captureWorkspaceScreenshot(1.5);
      if (!base64Image) {
        setFeedback("Failed to capture a screenshot of the page.");
        setMarkingProgress(null);
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: {
          parts: [
            { text: `You are an expert examiner marking a student's past paper. Analyze the provided image, which contains the original exam paper and the student's handwritten answers (drawn over it in colored/black strokes). 
            
            Assume the paper's coordinate system is exactly 800 pixels wide and 1131 pixels high.
            
            CRITICAL GRADING RULES:
            1. The student's answers are ONLY indicated by custom handwritten strokes, text, or sketches drawn/layered OVER the original printed paper.
            2. If a question has NO student handwriting, markings, or drawings in its answer area, it is completely blank/unanswered. You MUST award exactly 0 marks for that question.
            3. DO NOT hallucinate student answers. Do NOT assume the printed question text or printed diagrams are student answers.
            4. If the page contains no student drawings or writing at all, the score for this page MUST be exactly "0" (e.g. "0/5" or "0/15" depending on the page's total marks).
            
            Please provide:
            1. A score out of the total possible marks for this page (e.g., "4/5" or "0/20").
            2. Detailed feedback on what they did right and wrong.
            3. An array of "corrections" to be written directly on the paper. 
               - Include the marks for each question next to the question (e.g., "4/5" or "0/3").
               - Provide short text corrections (e.g., "Missing units", "Formula error", "No attempt").
               - Provide exact x and y coordinates. IMPORTANT: x MUST be between 50 and 550 (to leave room for text wrapping), and y MUST be between 50 and 1080.
               - Use "red" for mistakes/deductions/unanswered and "green" for correct parts/full marks.
            
            Format your response as JSON with keys: 
            "score" (string, e.g., "15/20" or "0/15"), 
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
      
      // Update annotations in DB for this page
      const docRef = doc(db, 'user_papers', id);
      await updateDoc(docRef, {
        aiAnnotations: JSON.stringify(updatedAiAnnotations),
        updatedAt: new Date().toISOString()
      });
      
      // Do NOT set status to 'completed' or update global score when only marking one page
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
        
        const base64Image = await captureWorkspaceScreenshot(1.2);
        if (base64Image) {
          images.push({
            inlineData: { data: base64Image, mimeType: 'image/jpeg' }
          });
        }
      }

      setMarkingProgress(`AI is analyzing the entire paper...`);

      const prompt = `You are an expert examiner marking a student's past paper. I am providing images of all ${numPages} pages of the exam paper, in order. The student's handwritten answers are drawn over the original paper in colored/black strokes.

      Assume each page's coordinate system is exactly 800 pixels wide and 1131 pixels high.

      CRITICAL GRADING RULES:
      1. The student's answers are ONLY indicated by custom handwritten strokes, text, or sketches drawn/layered OVER the original printed paper.
      2. If a question has NO student handwriting, markings, or drawings in its answer area, it is completely blank/unanswered. You MUST award exactly 0 marks for that question.
      3. DO NOT hallucinate student answers. Do NOT assume the printed question text or printed diagrams are student answers.
      4. The total score MUST only sum up the marks earned from actual handwritten/drawn answers. For example, if a paper has 80 total possible marks, and they only answered one 1-mark question correctly and left everything else blank, their score MUST be exactly "1/80", NOT "35/80" or any other number.

      Please provide:
      1. A total score for the entire paper. You MUST calculate the total marks scored and the total possible marks for the entire paper. Format this EXACTLY as "Scored/Total" (e.g., "1/35" or "15/80").
      2. Overall feedback for the entire paper.
      3. For EACH page, an array of "corrections" to be written directly on the paper. 
         - Include the marks for each question next to the question (e.g., "0/5" or "1/1").
         - Provide short text corrections (e.g., "No attempt", "Missing units", "Formula error"). Keep them concise.
         - Provide exact x and y coordinates. IMPORTANT: x MUST be between 50 and 550 (to leave room for text wrapping), and y MUST be between 50 and 1080.
         - Use "red" for mistakes/deductions/unanswered and "green" for correct parts/full marks.

      Format your response as JSON:
      {
        "totalScore": "1/35",
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

      const ai = getAiClient();
      if (!ai) {
        setFeedback("AI capabilities are currently disabled. Please add a GEMINI_API_KEY environment variable in Vercel.");
        setMarkingProgress(null);
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
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
      const numericScore = parseScoreToPercent(result.totalScore) || paper.score || 0;
      
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

  if (!paper) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black font-sans z-50">
        <div className="flex flex-col items-center">
          <motion.img 
            src="/logo.png" 
            alt="Loading..."
            animate={{ rotateY: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-16 h-16 object-contain invert brightness-0"
          />
          <ZenoLoading />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col h-[100dvh] bg-[#F5F5F7] dark:bg-[#0A0A0A] font-sans transition-colors duration-300">
      {/* Top Bar */}
      <div className="shrink-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm z-30 relative">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2.5 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full transition-all shadow-sm active:scale-95 border border-gray-200/50 dark:border-gray-700/50">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white truncate max-w-[200px] md:max-w-md">{paper.title}</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-200/50 dark:bg-gray-800/50 p-1.5 rounded-2xl hidden sm:flex backdrop-blur-sm">
          <button 
            onClick={() => setTool('select')}
            title="Select/Scroll"
            className={`p-2.5 rounded-xl transition-all ${tool === 'select' ? 'bg-white dark:bg-gray-700 shadow-md text-indigo-500 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
          >
            <MousePointer2 className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
          <button 
            onClick={() => setTool('pen')}
            title="Pen"
            className={`p-2.5 rounded-xl transition-all ${tool === 'pen' ? 'bg-white dark:bg-gray-700 shadow-md text-indigo-500 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
          >
            <Pen className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setTool('highlighter')}
            title="Highlighter"
            className={`p-2.5 rounded-xl transition-all ${tool === 'highlighter' ? 'bg-white dark:bg-gray-700 shadow-md text-indigo-500 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
          >
            <Highlighter className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setTool('eraser')}
            title="Eraser"
            className={`p-2.5 rounded-xl transition-all ${tool === 'eraser' ? 'bg-white dark:bg-gray-700 shadow-md text-indigo-500 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
          >
            <Eraser className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
          
          <button 
            onClick={() => setPencilOnly(!pencilOnly)}
            title="Draw with Apple Pencil Only"
            className={`p-2.5 rounded-xl transition-all ${pencilOnly ? 'bg-white dark:bg-gray-700 shadow-md text-indigo-500 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
          >
            <PenTool className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
          
          <div className="flex gap-1.5 px-1">
            {tool !== 'eraser' ? (
              ['#000000', '#EF4444', '#3B82F6', '#10B981'].map(color => (
                <button
                  key={color}
                  onClick={() => setPenColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${penColor === color ? 'scale-110 border-white shadow-sm dark:border-gray-300' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: color }}
                />
              ))
            ) : (
              <div className="w-6 h-6" /> // Placeholder to maintain spacing
            )}
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
          
          <div className="flex items-center gap-1">
            {(tool === 'eraser' ? [10, 20, 40] : [2, 4, 8]).map(size => (
              <button
                key={size}
                onClick={() => tool === 'eraser' ? setEraserSize(size) : setPenSize(size)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${(tool === 'eraser' ? eraserSize : penSize) === size ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <div className="bg-gray-800 dark:bg-gray-200 rounded-full" style={{ width: size === 2 || size === 10 ? 4 : size === 4 || size === 20 ? 6 : 10, height: size === 2 || size === 10 ? 4 : size === 4 || size === 20 ? 6 : 10 }}></div>
              </button>
            ))}
          </div>
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
          {numPages && (
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
      <div className="shrink-0 sm:hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 p-2 flex flex-col gap-2 z-20 sticky top-0">
        <div className="flex justify-center gap-2">
          <button 
            onClick={() => setTool('select')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 font-semibold text-sm ${tool === 'select' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setTool('pen')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 font-semibold text-sm ${tool === 'pen' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <Pen className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setTool('highlighter')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 font-semibold text-sm ${tool === 'highlighter' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <Highlighter className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setTool('eraser')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 font-semibold text-sm ${tool === 'eraser' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setPencilOnly(!pencilOnly)}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 font-semibold text-sm ${pencilOnly ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            title="Pencil Only"
          >
            <PenTool className="w-4 h-4" />
          </button>
        </div>
        {tool !== 'select' && (
          <div className="flex justify-between items-center px-1">
            <div className="flex gap-2">
              {(tool === 'pen' || tool === 'highlighter') ? ['#000000', '#EF4444', '#3B82F6', '#10B981'].map(color => (
                <button
                  key={color}
                  onClick={() => setPenColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${penColor === color ? 'scale-110 border-indigo-500 dark:border-indigo-400 shadow-sm' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              )) : <div></div>}
            </div>
            <div className="flex gap-2 items-center">
              {(tool === 'eraser' ? [10, 20, 40] : [2, 4, 8]).map(size => (
                <button
                  key={size}
                  onClick={() => tool === 'eraser' ? setEraserSize(size) : setPenSize(size)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${(tool === 'eraser' ? eraserSize : penSize) === size ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                >
                  <div className="bg-gray-800 dark:bg-gray-200 rounded-full" style={{ width: size === 2 || size === 10 ? 4 : size === 4 || size === 20 ? 6 : 10, height: size === 2 || size === 10 ? 4 : size === 4 || size === 20 ? 6 : 10 }}></div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none flex flex-col items-center p-4 md:p-8 relative" style={{ WebkitOverflowScrolling: 'touch' }}>
        {markingProgress && (
          <div className="absolute inset-0 z-50 bg-white/40 dark:bg-gray-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-10 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] flex flex-col items-center max-w-sm text-center border border-white dark:border-gray-700">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-inner dark:shadow-none">
                <motion.img 
                  src="/logo.png" 
                  alt="Loading..."
                  animate={{ rotateY: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="w-8 h-8 object-contain dark:invert dark:brightness-0"
                />
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
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}
                  style={{ touchAction: tool === 'select' ? 'auto' : 'none' }}
                  ref={stageRef}
                >
                  <Layer>
                    {lines.filter(l => l.page === pageNumber || !l.page).map((line, i) => (
                      <Line
                        key={i}
                        points={line.points}
                        stroke={line.color || (line.tool === 'eraser' ? 'white' : '#000000')}
                        strokeWidth={line.size || (line.tool === 'eraser' ? 20 : 3)}
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
              <div className="prose prose-sm max-w-none prose-p:text-gray-700 dark:prose-p:text-gray-200 prose-headings:text-gray-900 dark:prose-headings:text-white prose-strong:text-gray-900 dark:prose-strong:text-white prose-li:text-gray-700 dark:prose-li:text-gray-200 prose-ol:text-gray-700 dark:prose-ol:text-gray-200 prose-ul:text-gray-700 dark:prose-ul:text-gray-200 prose-markers:text-gray-500 dark:prose-markers:text-gray-400 marker:text-gray-500 dark:marker:text-gray-400">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{feedback}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Pagination */}
      {numPages && numPages > 1 && (
        <div className="shrink-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 p-4 flex justify-center items-center gap-6 z-20 pb-[env(safe-area-inset-bottom,16px)]">
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
          paperId={id || ''}
          onClose={() => setShowChat(false)} 
          paperContext={`Paper Title: ${paper.title}, Current Page: ${pageNumber}`} 
          onCaptureScreenshot={async () => {
            return captureWorkspaceScreenshot(0.8);
          }}
        />
      )}
    </div>
  );
}
