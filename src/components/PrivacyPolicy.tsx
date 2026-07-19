export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0A0A0A] py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <div className="max-w-3xl mx-auto bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl p-8 md:p-12 rounded-3xl shadow-sm border border-gray-200/50 dark:border-gray-800/50">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">Privacy Policy</h1>
        <div className="prose prose-gray dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 space-y-6">
          <p>
            At Astris.ai, we take your privacy seriously. This policy outlines how we collect, use, and protect your data.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">1. Data Collection</h2>
          <p>
            We collect information you provide directly to us when you create an account, upload documents, and interact with our AI features. This includes your basic profile information and the content of uploaded papers.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">2. Data Usage</h2>
          <p>
            Your data is used solely to provide and improve the Astris.ai service. We use AI models to process your documents and generate feedback. We do not sell your personal data to third parties.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">3. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your information. Your data is stored securely using encrypted cloud infrastructure.
          </p>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
            <a href="/login" className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">
              &larr; Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
