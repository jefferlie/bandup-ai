import Header from "../components/Header";

const Terms = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Header showAuth={true} />
    <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Terms of Service</h1>
      <div className="space-y-4 text-muted-foreground text-base">
        <p>
          These Terms of Service govern your use of the BandUp platform. By using the service, you
          agree to follow all rules and conditions described in this document.
        </p>
        <p>1. The platform is intended for educational use only.</p>
        <p>2. You must not share your account credentials with third parties.</p>
        <p>3. All materials are protected by copyright and may not be used without permission.</p>
        <p>4. The platform administration may update these terms at any time.</p>
        <p>5. Full terms are available upon request.</p>
      </div>
    </main>
  </div>
);

export default Terms;
