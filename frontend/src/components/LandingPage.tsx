'use client';

import React from 'react';
import { DOMAIN_CONFIG } from '@/lib/utils';
import { DomainId } from '@/types';

const BLOG_URL =
  'https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/from-manual-document-processing-to-ai-orchestrated-intelligence/4498835';
const REPO_URL = 'https://github.com/lordlinus/idp-workflow';
const VIDEO_URL =
  'https://microsoftapc-my.sharepoint.com/:v:/g/personal/ssattiraju_microsoft_com/IQDWCHohOsIbTKQ6V0P3_W4HAc2LCakHbNmPfba6F3ahT4E?e=NSVAbm';

interface LandingPageProps {
  onGetStarted: () => void;
}

/* ------------------------------------------------------------------ */
/*  Pipeline steps — static data for the CSS-only flow visualization  */
/* ------------------------------------------------------------------ */
const PIPELINE_STEPS = [
  { number: 1, icon: '📄', name: 'PDF Extraction', desc: 'Azure Document Intelligence converts PDFs to structured Markdown' },
  { number: 2, icon: '🏷️', name: 'Classification', desc: 'DSPy ChainOfThought classifies each page independently' },
  {
    number: 3,
    parallel: true,
    branches: [
      { icon: '☁️', name: 'Azure CU', desc: 'Content Understanding structured extraction' },
      { icon: '🤖', name: 'DSPy LLM', desc: 'Multi-provider LLM extraction (Azure OpenAI, Claude, OSS)' },
    ],
  },
  { number: 4, icon: '⚖️', name: 'Comparison', desc: 'Field-by-field diff with match scoring' },
  { number: 5, icon: '👤', name: 'Human Review', desc: 'HITL gate — approve, reject, or edit disputed fields' },
  { number: 6, icon: '🧠', name: 'AI Reasoning', desc: 'Agent validates, consolidates, and scores confidence' },
] as const;

/* ------------------------------------------------------------------ */
/*  Capability cards                                                   */
/* ------------------------------------------------------------------ */
const CAPABILITIES = [
  {
    icon: '🔀',
    title: 'Dual-Model Extraction',
    desc: 'Run Azure Content Understanding and a DSPy LLM extractor in parallel. Agreement means high confidence; disagreement focuses human attention on specific fields.',
  },
  {
    icon: '🔌',
    title: 'Multi-Provider LLM',
    desc: 'Switch between Azure OpenAI (GPT-4.1, o3-mini), Claude, or open-weight models on Azure AI (Qwen, DeepSeek, Llama, Phi) — one dropdown, no redeployment.',
  },
  {
    icon: '👤',
    title: 'Human-in-the-Loop',
    desc: 'Pipeline pauses for human review using Durable Functions native external events. Reviewers see side-by-side comparisons and the pipeline auto-resumes on submit.',
  },
  {
    icon: '📁',
    title: 'Domain-Driven Design',
    desc: 'Add a new document type with four JSON files — extraction schema, classification categories, validation rules, and config. Zero code changes required.',
  },
  {
    icon: '⚡',
    title: 'Real-Time Visibility',
    desc: 'SignalR streams step-level events to the dashboard. Watch each pipeline step execute, see progress bars, and receive instant notifications.',
  },
  {
    icon: '🧠',
    title: 'AI Reasoning Agent',
    desc: 'A tool-calling agent (Microsoft Agent Framework) validates against domain business rules, consolidates extractions, and generates confidence scores with recommendations.',
  },
];

/* ------------------------------------------------------------------ */
/*  Tech stack badges                                                  */
/* ------------------------------------------------------------------ */
const TECH_STACK = [
  'Azure Durable Functions',
  'Azure Document Intelligence',
  'Azure Content Understanding',
  'Azure OpenAI',
  'DSPy',
  'Microsoft Agent Framework',
  'Next.js',
  'SignalR',
];

/* ------------------------------------------------------------------ */
/*  How It Works timeline                                              */
/* ------------------------------------------------------------------ */
const WALKTHROUGH = [
  { step: 1, title: 'Upload & Extract', desc: 'Document hits the dashboard. Azure Document Intelligence converts all pages to structured Markdown, preserving tables and layout.' },
  { step: 2, title: 'Per-Page Classification', desc: 'Each page classified independently — e.g. Page 1: Loan Application, Page 2: Income Verification — each with its own confidence score.' },
  { step: 3, title: 'Dual Extraction', desc: 'Azure CU and the DSPy LLM extractor run simultaneously. Both use the same domain schema but approach extraction differently.' },
  { step: 4, title: 'Field-by-Field Comparison', desc: 'System finds matching and differing fields between extractors. Disagreements are highlighted for focused human review.' },
  { step: 5, title: 'Human Review', desc: 'Reviewer sees both values side by side for disputed fields, picks the correct value or types a correction, and approves. Pipeline resumes instantly.' },
  { step: 6, title: 'AI Reasoning & Validation', desc: 'Agent validates against domain business rules, checks cross-field logic, and generates a final confidence score with recommendations.' },
];

/* ------------------------------------------------------------------ */
/*  Making It Real — customer explorations                             */
/* ------------------------------------------------------------------ */
const CUSTOMER_SCENARIOS = [
  {
    icon: '🏦',
    industry: 'Financial Services',
    useCase: 'Mortgage & Loan Underwriting',
    before: '2–5 days',
    after: 'Minutes',
    detail: 'Dual-model extraction catches errors that single-model pipelines miss. Human review focuses on the 10–15% of fields that actually need attention, not the entire document.',
  },
  {
    icon: '📋',
    industry: 'Insurance',
    useCase: 'Claims Intake & Adjudication',
    before: '4–8 hours',
    after: 'Minutes',
    detail: 'Per-page classification handles multi-section claims correctly. AI reasoning agent validates against policy rules automatically. Complete audit trail for regulatory compliance.',
  },
  {
    icon: '🏥',
    industry: 'Healthcare',
    useCase: 'Medical Records & Billing',
    before: 'Hours',
    after: 'Minutes',
    detail: 'Domain-driven schemas handle varied medical form formats. Confidence scoring prioritizes which records need human verification.',
  },
  {
    icon: '🚢',
    industry: 'Trade Finance',
    useCase: 'Letter of Credit & Invoice Verification',
    before: 'Days',
    after: 'Minutes',
    detail: 'Parallel extraction cross-validates financial figures. Field-by-field comparison surfaces discrepancies instantly rather than after manual review.',
  },
  {
    icon: '🏛️',
    industry: 'Government',
    useCase: 'Permit & Application Processing',
    before: 'Weeks',
    after: 'Hours',
    detail: 'Zero-code domain extensibility means new form types are onboarded with JSON configs, not development cycles.',
  },
];

const WHY_CUSTOMERS_CARE = [
  { icon: '🎯', title: 'Accuracy over speed alone', desc: 'Dual-model cross-validation means higher accuracy than any single model. Disagreements direct human attention to exactly the fields that need it.' },
  { icon: '🔒', title: 'Compliance built in', desc: 'Every step, every decision, every human override is timestamped. No separate audit system needed.' },
  { icon: '🔄', title: 'No AI vendor lock-in', desc: 'Switch between Azure OpenAI, Claude, or open-weight models on Azure AI from a dropdown — no redeployment.' },
  { icon: '⚡', title: 'Days to onboard new doc types', desc: 'Four JSON files per domain. No code changes, no model retraining, no development cycles.' },
];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */
export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-dark-950 text-dark-50">
      {/* ---- Floating nav ---- */}
      <nav className="sticky top-0 z-50 border-b border-dark-800/60 bg-dark-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight">DocProcessIQ</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-dark-400 hover:text-dark-200 transition-colors">
              GitHub
            </a>
            <a href={BLOG_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-dark-400 hover:text-dark-200 transition-colors">
              Blog
            </a>
            <button onClick={onGetStarted} className="btn-primary text-xs px-4 py-1.5">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ================================================================ */}
      {/*  A. Hero                                                         */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden">
        {/* Gradient background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-blue-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-dark-700/60 bg-dark-800/40 text-xs text-dark-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open Source &middot; Azure Durable Functions &middot; DSPy
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            From Manual Document Processing to{' '}
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              AI-Orchestrated Intelligence
            </span>
          </h1>

          <p className="text-lg md:text-xl text-dark-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            What used to take hours of manual processing — done in minutes. AI does the heavy lifting,
            a human makes the judgment call, and there&apos;s a complete audit trail for compliance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={onGetStarted}
              className="px-8 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
            >
              Get Started
            </button>
            <a
              href={BLOG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-xl font-semibold border border-dark-600 text-dark-200 hover:border-dark-500 hover:text-dark-50 transition-all duration-200"
            >
              Read the Blog
            </a>
          </div>

          {/* Links row */}
          <div className="flex items-center justify-center gap-6 text-sm text-dark-400">
            <a href={BLOG_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-dark-200 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
              Blog Post
            </a>
            <span className="text-dark-700">|</span>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-dark-200 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
              GitHub
            </a>
            <span className="text-dark-700">|</span>
            <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-dark-200 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /></svg>
              Watch Video
            </a>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  Video Demo                                                      */}
      {/* ================================================================ */}
      <section className="border-t border-dark-800/60 bg-dark-900/30">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Watch the Demo</h2>
          <p className="text-dark-400 text-center max-w-2xl mx-auto mb-10">
            See the full pipeline in action — from PDF upload to AI-validated structured output.
          </p>

          {/* Video player */}
          <div className="relative rounded-2xl border border-dark-700/60 bg-dark-800/40 overflow-hidden shadow-2xl shadow-black/30">
            <video
              className="w-full"
              controls
              preload="metadata"
              poster=""
            >
              <source src="/IDP_03_Mar_video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  B. Problem Statement                                            */}
      {/* ================================================================ */}
      <section className="border-t border-dark-800/60">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">The Problem</h2>
          <p className="text-dark-400 text-center max-w-2xl mx-auto mb-12">
            Organisations have tried to automate document processing before — but existing approaches fall into one of two camps:
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            {/* Manual */}
            <div className="rounded-xl border border-dark-700/60 bg-dark-800/40 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center text-lg">🐢</div>
                <h3 className="font-semibold text-dark-100">Manual Processing</h3>
              </div>
              <p className="text-sm text-dark-400 leading-relaxed">
                Humans read, classify, and key in data. Accurate but slow, expensive, and impossible to scale.
                Multiple people, hours or days per document, accuracy depends on attention.
              </p>
            </div>

            {/* Single model */}
            <div className="rounded-xl border border-dark-700/60 bg-dark-800/40 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center text-lg">⚠️</div>
                <h3 className="font-semibold text-dark-100">Single-Model Extraction</h3>
              </div>
              <p className="text-sm text-dark-400 leading-relaxed">
                Throw an OCR/AI model at the document, trust the output. Fast but fragile — no validation,
                no human checkpoint, no confidence scoring. Breaks when formats change.
              </p>
            </div>
          </div>

          {/* Bridge */}
          <div className="max-w-3xl mx-auto text-center rounded-xl border border-blue-500/20 bg-blue-500/[0.04] px-8 py-6">
            <p className="text-dark-200 leading-relaxed">
              <span className="font-semibold text-blue-400">What&apos;s missing</span> is the middle ground: an{' '}
              <span className="font-semibold text-dark-50">orchestrated, multi-model pipeline</span> with
              built-in quality gates, real-time visibility, and the flexibility to handle any document type without rewriting code.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  C. Pipeline Flow                                                */}
      {/* ================================================================ */}
      <section className="border-t border-dark-800/60 bg-dark-900/30">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">The 6-Step AI Pipeline</h2>
          <p className="text-dark-400 text-center max-w-2xl mx-auto mb-14">
            Each step broadcasts real-time events via SignalR. The frontend updates as work progresses.
          </p>

          {/* Pipeline visualization */}
          <div className="flex flex-col gap-3 max-w-3xl mx-auto">
            {PIPELINE_STEPS.map((step, idx) => (
              <React.Fragment key={idx}>
                {/* Connector */}
                {idx > 0 && (
                  <div className="flex justify-center">
                    <div className="w-px h-6 bg-gradient-to-b from-dark-600 to-dark-700" />
                  </div>
                )}

                {'parallel' in step && step.parallel ? (
                  /* Parallel step (3a + 3b) */
                  <div>
                    <div className="text-center mb-2">
                      <span className="text-xs text-dark-500 font-medium uppercase tracking-wider">Step {step.number} — Parallel Execution</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {step.branches.map((branch, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-3 rounded-xl border border-purple-500/20 bg-purple-500/[0.04] px-5 py-4">
                          <span className="text-2xl flex-shrink-0 mt-0.5">{branch.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-purple-400">{step.number}{String.fromCharCode(97 + bIdx)}</span>
                              <span className="font-semibold text-dark-100 text-sm">{branch.name}</span>
                            </div>
                            <p className="text-xs text-dark-400 mt-1">{branch.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Regular step */
                  <div className="flex items-start gap-4 rounded-xl border border-dark-700/60 bg-dark-800/40 px-5 py-4">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{'icon' in step ? step.icon : ''}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-blue-400">{'number' in step ? step.number : ''}</span>
                        <span className="font-semibold text-dark-100 text-sm">{'name' in step ? step.name : ''}</span>
                      </div>
                      <p className="text-xs text-dark-400 mt-1">{'desc' in step ? step.desc : ''}</p>
                    </div>
                    {/* Special badge for HITL */}
                    {'number' in step && step.number === 5 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/10 flex-shrink-0 mt-1">
                        HITL Gate
                      </span>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}

            {/* Result */}
            <div className="flex justify-center">
              <div className="w-px h-6 bg-gradient-to-b from-dark-600 to-emerald-600" />
            </div>
            <div className="flex items-center justify-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-6 py-4">
              <span className="text-2xl">✅</span>
              <div>
                <span className="font-semibold text-emerald-300 text-sm">Structured Result</span>
                <p className="text-xs text-dark-400">Validated, scored, and ready for downstream systems</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  D. Key Capabilities                                             */}
      {/* ================================================================ */}
      <section className="border-t border-dark-800/60">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Key Capabilities</h2>
          <p className="text-dark-400 text-center max-w-2xl mx-auto mb-14">
            Built for enterprise document processing with quality, transparency, and extensibility at every layer.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map((cap) => (
              <div key={cap.title} className="rounded-xl border border-dark-700/60 bg-dark-800/30 p-6 hover:border-dark-600/80 transition-colors">
                <div className="text-3xl mb-4">{cap.icon}</div>
                <h3 className="font-semibold text-dark-100 mb-2">{cap.title}</h3>
                <p className="text-sm text-dark-400 leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  E. Supported Domains                                            */}
      {/* ================================================================ */}
      <section className="border-t border-dark-800/60 bg-dark-900/30">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Supported Domains</h2>
          <p className="text-dark-400 text-center max-w-2xl mx-auto mb-14">
            Five domains ship out of the box. Adding a new document type?{' '}
            <span className="font-semibold text-dark-200">Four JSON files. Zero code changes.</span>
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {(Object.entries(DOMAIN_CONFIG) as [DomainId, { label: string; icon: string; description: string }][]).map(
              ([id, config]) => (
                <div key={id} className="flex items-start gap-3 rounded-xl border border-dark-700/60 bg-dark-800/40 px-5 py-4">
                  <span className="text-2xl flex-shrink-0">{config.icon}</span>
                  <div>
                    <p className="font-semibold text-dark-100 text-sm">{config.label}</p>
                    <p className="text-xs text-dark-400 mt-1">{config.description}</p>
                  </div>
                </div>
              ),
            )}
            {/* Add-your-own card */}
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-dark-600/60 bg-dark-800/20 px-5 py-4">
              <span className="text-2xl flex-shrink-0">➕</span>
              <div>
                <p className="font-semibold text-dark-100 text-sm">Your Domain</p>
                <p className="text-xs text-dark-400 mt-1">Add config.json, extraction_schema.json, classification_categories.json, and validation_rules.json</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  F. How It Works — walkthrough with stats                        */}
      {/* ================================================================ */}
      <section className="border-t border-dark-800/60">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">See It In Action</h2>
          <p className="text-dark-400 text-center max-w-2xl mx-auto mb-14">
            Processing a multi-page home loan application — from raw PDF to structured, validated data.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-14">
            {[
              { value: 'Minutes', label: 'Processing Time', sub: 'vs hours manually' },
              { value: '87.5%', label: 'Field Match', sub: '14/16 fields agreed' },
              { value: '92%', label: 'Confidence Score', sub: 'AI-validated result' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-dark-200 mt-1">{stat.label}</div>
                <div className="text-xs text-dark-500 mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="max-w-3xl mx-auto space-y-0">
            {WALKTHROUGH.map((item, idx) => (
              <div key={item.step} className="relative flex gap-5">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-500/40 bg-dark-800 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0 z-10">
                    {item.step}
                  </div>
                  {idx < WALKTHROUGH.length - 1 && (
                    <div className="w-px flex-1 bg-dark-700 min-h-[2rem]" />
                  )}
                </div>
                {/* Content */}
                <div className="pb-8">
                  <h4 className="font-semibold text-dark-100 text-sm">{item.title}</h4>
                  <p className="text-xs text-dark-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  Making It Real                                                   */}
      {/* ================================================================ */}
      <section className="border-t border-dark-800/60 bg-dark-900/30">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Making It Real</h2>
          <p className="text-dark-400 text-center max-w-2xl mx-auto mb-14">
            We&apos;re actively exploring this pattern with customers across industries where
            high-volume document processing is a bottleneck. Here&apos;s the value we&apos;re seeing.
          </p>

          <div className="space-y-4 max-w-4xl mx-auto">
            {CUSTOMER_SCENARIOS.map((scenario) => (
              <div key={scenario.industry} className="rounded-xl border border-dark-700/60 bg-dark-800/40 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Left: industry + use case */}
                  <div className="md:w-1/3 px-6 py-5 md:border-r border-dark-700/40">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{scenario.icon}</span>
                      <div>
                        <p className="font-semibold text-dark-100 text-sm">{scenario.industry}</p>
                        <p className="text-xs text-dark-400">{scenario.useCase}</p>
                      </div>
                    </div>
                    {/* Before → After badge */}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
                        {scenario.before}
                      </span>
                      <svg className="w-4 h-4 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                        {scenario.after}
                      </span>
                    </div>
                  </div>
                  {/* Right: detail */}
                  <div className="md:w-2/3 px-6 py-5">
                    <p className="text-sm text-dark-300 leading-relaxed">{scenario.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Why customers care */}
          <div className="mt-14 grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {WHY_CUSTOMERS_CARE.map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-lg border border-dark-700/40 bg-dark-800/20 px-5 py-4">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="font-semibold text-dark-100 text-sm">{item.title}</p>
                  <p className="text-xs text-dark-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  G. Tech Stack                                                   */}
      {/* ================================================================ */}
      <section className="border-t border-dark-800/60 bg-dark-900/30">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-lg font-semibold text-center text-dark-300 mb-8">Built With</h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="px-4 py-1.5 rounded-full border border-dark-700/60 bg-dark-800/40 text-xs text-dark-300 font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  H. Footer CTA                                                   */}
      {/* ================================================================ */}
      <section className="border-t border-dark-800/60">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Try It?</h2>
          <p className="text-dark-400 max-w-xl mx-auto mb-8">
            Upload a document and watch the 6-step AI pipeline process it end to end — with real-time visibility and human oversight.
          </p>
          <button
            onClick={onGetStarted}
            className="px-10 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-lg"
          >
            Get Started
          </button>

          <div className="flex items-center justify-center gap-6 mt-10 text-sm text-dark-500">
            <a href={BLOG_URL} target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">Blog Post</a>
            <span className="text-dark-700">|</span>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">GitHub Repository</a>
            <span className="text-dark-700">|</span>
            <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">Watch Video</a>
          </div>
        </div>
      </section>

      {/* Bottom gradient line */}
      <div className="h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />
    </div>
  );
}
