export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0A0A0A] py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <div className="max-w-3xl mx-auto bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl p-8 md:p-12 rounded-3xl shadow-sm border border-gray-200/50 dark:border-gray-800/50">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">Terms of Service</h1>
        <div className="prose prose-gray dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 space-y-6">
          <p>
            Welcome to Astris.ai. By accessing or using our service, you agree to be bound by these Terms of Service.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>
            By creating an account and using Astris.ai, you accept these terms in full. If you disagree with any part of these terms, you must not use our service.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">2. User Content</h2>
          <p>
            You retain all rights to the papers and documents you upload. By uploading content, you grant Astris.ai a license to process and analyze this content solely to provide you with the AI grading and review features.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">3. Acceptable Use</h2>
          <p>
            You agree not to use the service for any illegal purposes or to upload content that infringes upon the rights of others.
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
