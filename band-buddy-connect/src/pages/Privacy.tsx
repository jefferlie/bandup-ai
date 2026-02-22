import Header from "../components/Header";

const Privacy = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Header showAuth={true} />
    <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Privacy Policy</h1>
      <div className="space-y-4 text-muted-foreground text-base">
        <p>BandUp respects your privacy and protects your personal information.</p>
        <p>1. We collect only the minimum data necessary to provide the service.</p>
        <p>2. Your data is not shared with third parties without your consent.</p>
        <p>3. All data is stored securely and used only to improve service quality.</p>
        <p>4. You can request deletion of your data by contacting support.</p>
        <p>5. Detailed information is available upon request.</p>
      </div>
    </main>
  </div>
);

export default Privacy;
