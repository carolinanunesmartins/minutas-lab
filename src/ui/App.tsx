import { messages } from './messages.pt';

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-slate-900">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{messages.appTitle}</h1>
        <p className="mt-2 text-slate-600">{messages.appTagline}</p>
      </div>
    </main>
  );
}

export default App;
