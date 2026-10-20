import React from 'react';
import { ArrowRight, Sparkles, Zap, Target, Palette, PlayCircle, CheckCircle2, TrendingUp, Layers, MousePointerClick, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';

export function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full bg-background text-foreground selection:bg-primary/30 overflow-x-hidden font-sans">
      
      {/* 1. HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-60 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/80 border border-border text-primary text-sm font-medium mb-8 shadow-xl animate-fade-in-up" style={{animationDelay: '0.1s'}}>
            <Sparkles className="h-4 w-4" />
            <span>Version 2.0 is now live for all creators</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl font-extrabold tracking-tight mb-8 leading-[1.1] text-foreground animate-fade-in-up" style={{animationDelay: '0.2s'}}>
            Scale Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-indigo-400">Digital Empire</span><br className="hidden md:block" /> at the Speed of Light
          </h1>
          
          <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mb-12 leading-relaxed animate-fade-in-up" style={{animationDelay: '0.3s'}}>
            The ultimate AI generation studio. Instantly create 4K print-ready art, stunning realistic mockups, and SEO-optimized listings tailored exclusively for Etsy and Adobe Stock.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
            <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-primary hover:bg-primary/90 text-foreground shadow-[0_0_30px_rgba(79,70,229,0.4)] hover:shadow-[0_0_50px_rgba(79,70,229,0.6)] transition-all duration-300 border-none" onClick={onStart}>
              Start Generating Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-full border-border bg-muted/50 hover:bg-card text-muted-foreground transition-all duration-300">
              <PlayCircle className="mr-2 h-5 w-5 text-muted-foreground" /> Watch Demo
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground animate-fade-in-up" style={{animationDelay: '0.5s'}}>No credit card required. Generate up to 10 products free.</p>
        </div>

        {/* Dashboard Mockup Placeholder */}
        <div className="relative mt-20 max-w-6xl mx-auto px-6 animate-fade-in-up" style={{animationDelay: '0.6s'}}>
          <div className="rounded-2xl border border-border bg-muted/80 backdrop-blur-xl shadow-2xl p-2 md:p-4 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-transparent to-transparent z-10 pointer-events-none rounded-2xl h-[400px] bottom-0 top-auto"></div>
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <div className="aspect-video bg-muted rounded-xl border border-border flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary to-transparent"></div>
              <div className="text-center z-10">
                <Palette className="h-16 w-16 text-slate-700 mx-auto mb-4" />
                <h3 className="text-muted-foreground font-medium">Interactive Studio Interface</h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. LOGO CLOUD */}
      <section className="py-12 border-y border-border bg-muted/20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-8">Trusted by top sellers on leading platforms</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 grayscale">
            <span className="text-2xl font-bold font-serif">Etsy</span>
            <span className="text-2xl font-bold flex items-center gap-1"><span className="text-red-500">A</span> Adobe Stock</span>
            <span className="text-2xl font-bold tracking-tight">Shopify</span>
            <span className="text-2xl font-bold italic">Redbubble</span>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-foreground mb-4">From Idea to Listing in 3 Steps</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Skip the hours of manual work. Our AI pipeline handles the entire product creation lifecycle instantly.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            
            {[
              { step: "01", title: "Input Keywords", desc: "Enter your niche ideas or let our Keyword Research tool find high-demand, low-competition keywords for you." },
              { step: "02", title: "AI Generation", desc: "Our engine generates 4K print files, creates realistic lifestyle mockups, and writes Etsy SEO-optimized titles and tags." },
              { step: "03", title: "Publish & Profit", desc: "Download the complete bundle. Upload straight to Etsy or Adobe Stock and watch your digital empire grow." }
            ].map((item, i) => (
              <div key={i} className="relative bg-muted/50 border border-border p-8 rounded-3xl hover:bg-card transition-colors">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-2xl font-bold text-primary mb-6 mx-auto md:mx-0 relative z-10 backdrop-blur-sm">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 text-center md:text-left">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-center md:text-left">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. DETAILED FEATURES */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 space-y-32">
          
          {/* Feature 1 */}
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-6">
                <Target className="h-4 w-4" /> SEO Optimization
              </div>
              <h2 className="text-4xl font-bold text-foreground mb-6 leading-tight">Dominate Etsy Search Results</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Stop guessing what buyers are searching for. Our AI analyzes current trends and generates long-tail keywords, highly converting titles, and engaging descriptions that satisfy Etsy's algorithm.
              </p>
              <ul className="space-y-4">
                {[
                  "Automated 13 Tags Generation",
                  "Algorithm-friendly Title structures",
                  "Compelling product descriptions",
                  "Real-time volume & difficulty metrics"
                ].map((txt, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary" /> {txt}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full">
              <div className="aspect-square md:aspect-[4/3] rounded-3xl border border-border bg-gradient-to-tr from-muted to-card p-8 relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMzMzMiLz48L3N2Zz4=')] opacity-20"></div>
                <div className="h-full w-full rounded-xl border border-border bg-muted/80 backdrop-blur-sm p-6 flex flex-col gap-4">
                  <div className="h-8 w-1/3 bg-card rounded"></div>
                  <div className="h-4 w-full bg-card/50 rounded"></div>
                  <div className="h-4 w-5/6 bg-card/50 rounded"></div>
                  <div className="mt-auto grid grid-cols-3 gap-2">
                    {[1,2,3,4,5,6].map(x => <div key={x} className="h-6 bg-primary/20 rounded border border-primary/30"></div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-16">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium mb-6">
                <Layers className="h-4 w-4" /> Photorealistic Mockups
              </div>
              <h2 className="text-4xl font-bold text-foreground mb-6 leading-tight">Sell the Lifestyle, Not Just the File</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Buyers purchase based on visuals. We automatically place your generated art onto 4K resolution realistic mockups?"from framed wall art and apparel to mugs and tote bags.
              </p>
              <ul className="space-y-4">
                {[
                  "24+ diverse mockup templates",
                  "Flawless lighting and shadows",
                  "Auto-transparent background removal",
                  "Ready to export as ZIP bundle"
                ].map((txt, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-purple-500" /> {txt}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full">
              <div className="aspect-square md:aspect-[4/3] rounded-3xl border border-border bg-gradient-to-tl from-muted to-card p-8 relative overflow-hidden shadow-2xl">
                <div className="h-full w-full grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card/50 flex items-center justify-center"><ImageIcon className="h-12 w-12 text-slate-600" /></div>
                  <div className="rounded-xl border border-border bg-card/50 flex items-center justify-center"><ImageIcon className="h-12 w-12 text-slate-600" /></div>
                  <div className="rounded-xl border border-border bg-card/50 flex items-center justify-center"><ImageIcon className="h-12 w-12 text-slate-600" /></div>
                  <div className="rounded-xl border border-border bg-card/50 flex items-center justify-center"><ImageIcon className="h-12 w-12 text-slate-600" /></div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* 5. STATS */}
      <section className="py-24 border-y border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">1.2M+</div>
              <div className="text-muted-foreground font-medium uppercase tracking-wider text-sm">Listings Created</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">15K+</div>
              <div className="text-muted-foreground font-medium uppercase tracking-wider text-sm">Active Sellers</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">99%</div>
              <div className="text-muted-foreground font-medium uppercase tracking-wider text-sm">Adobe Approval Rate</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">10x</div>
              <div className="text-muted-foreground font-medium uppercase tracking-wider text-sm">Faster Workflow</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FINAL CTA */}
      <section className="py-32 relative text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <h2 className="text-5xl font-bold text-foreground mb-8">Ready to Automate Your Digital Store?</h2>
          <p className="text-xl text-muted-foreground mb-12">Join thousands of creators who are scaling their Etsy and Adobe Stock portfolios on autopilot.</p>
          <Button size="lg" className="h-16 px-12 text-xl rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] transition-all duration-300 border-none" onClick={onStart}>
            Launch Studio <MousePointerClick className="ml-3 h-6 w-6" />
          </Button>
        </div>
      </section>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}} />
    </div>
  );
}

