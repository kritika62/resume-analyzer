import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display&family=Poppins:wght@300;400;500&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: linear-gradient(135deg, #f8c8dc, #e6ccff);
  font-family: 'Poppins', sans-serif;
  overflow-x: hidden;
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
  100% { transform: translateY(0px); }
}

.doodle {
  position: fixed;
  width: 85px;
  opacity: 0.4;
  animation: float 6s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

.doodle:nth-child(2) { animation-duration: 7s; }
.doodle:nth-child(3) { animation-duration: 5s; }
.doodle:nth-child(4) { animation-duration: 8s; }
.doodle:nth-child(5) { animation-duration: 6s; }
.doodle:nth-child(6) { animation-duration: 9s; }
.doodle:nth-child(7) { animation-duration: 7.5s; }

.blob {
  position: fixed;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #f8c8dc, transparent);
  filter: blur(80px);
  opacity: 0.4;
  z-index: 0;
}

.title {
  font-family: 'Playfair Display', serif;
  font-size: 2.4rem;
  color: #5a4a66;
  text-align: center;
  margin-bottom: 10px;
}

textarea {
  border-radius: 15px;
  border: 1px solid #333;
  padding: 12px;
  font-family: 'Poppins';
  outline: none;
  background: #1a1a22;
  color: white;
  font-size: 14px;
}

textarea:focus { border: 1px solid #e6ccff; }

button {
  background: #e6ccff;
  border: none;
  padding: 12px 25px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 15px;
  transition: 0.3s;
}

button:hover { background: #f8c8dc; transform: scale(1.05); }

.tab-btn {
  background: transparent;
  border: 1px solid #333;
  color: #aaa;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  font-family: 'Poppins';
  transition: 0.2s;
}

.tab-btn.active {
  background: #e6ccff;
  color: #1a1a22;
  border-color: #e6ccff;
}

.tab-btn:hover { transform: scale(1.03); }

.keyword-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  margin: 4px;
}

@keyframes spin { to { transform: rotate(360deg); } }
`;

function ScoreRing({ score }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#e6ccff" : score >= 40 ? "#fbbf24" : "#f87171";
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#333" strokeWidth="10" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "70px 70px", transition: "stroke-dashoffset 1s ease" }}
      />
      <text x="70" y="65" textAnchor="middle" fill={color} fontSize="28" fontWeight="800">{score}</text>
      <text x="70" y="85" textAnchor="middle" fill="#aaa" fontSize="11">/100</text>
    </svg>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", gap: 10, color: "#aaa", marginTop: 12 }}>
      <div style={{ width: 20, height: 20, border: "2px solid #333", borderTop: "2px solid #e6ccff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span>Analyzing...</span>
    </div>
  );
}

async function callBackend(resumeText, jobDescription) {
  const response = await fetch("https://resume-analyzer-production-c0d8.up.railway.app/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, jobDescription }),
  });
  if (!response.ok) throw new Error("API failed");
  return await response.json();
}

async function extractTextFromPDF(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async function () {
      const typedArray = new Uint8Array(this.result);
      const pdf = await pdfjsLib.getDocument(typedArray).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(" ") + "\n";
      }
      resolve(text);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const card = {
  background: "#1a1a22",
  borderRadius: 16,
  padding: "16px",
  marginTop: 14,
  border: "1px solid #2a2a35",
};

export default function App() {
  const [resumeText, setResumeText] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("score");

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === "application/pdf") {
      const text = await extractTextFromPDF(file);
      setResumeText(text);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setResumeText(ev.target.result);
      reader.readAsText(file);
    }
  };

  const analyze = async () => {
    if (!resumeText.trim()) { setError("Please add resume"); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await callBackend(resumeText, jobDesc);
      setResult(data);
      setTab("score");
    } catch {
      setError("Analysis failed. Is the server running?");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{globalCSS}</style>

      <img src="/flower1.png" className="doodle" style={{ top: "5%", left: "5%" }} alt="" />
      <img src="/flower2.png" className="doodle" style={{ top: "15%", right: "10%" }} alt="" />
      <img src="/flower1.png" className="doodle" style={{ top: "40%", left: "2%" }} alt="" />
      <img src="/flower2.png" className="doodle" style={{ top: "60%", right: "5%" }} alt="" />
      <img src="/flower1.png" className="doodle" style={{ bottom: "10%", left: "10%" }} alt="" />
      <img src="/flower2.png" className="doodle" style={{ bottom: "5%", right: "5%" }} alt="" />
      <img src="/flower1.png" className="doodle" style={{ top: "30%", right: "25%" }} alt="" />

      <div className="blob" style={{ top: "10%", left: "20%" }} />
      <div className="blob" style={{ bottom: "10%", right: "20%" }} />

      <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", padding: 20, position: "relative", zIndex: 1 }}>
        <h1 className="title">☆✧ Resume Analyzer ☆✧</h1>

        <div style={{ background: "#0f0f14", color: "white", padding: 35, borderRadius: 30, boxShadow: "0 15px 40px rgba(0,0,0,0.3)", marginTop: 20, width: "100%", maxWidth: "600px" }}>

          {/* Upload */}
          <label style={{ display: "inline-block", padding: "10px 15px", background: "#e6ccff", borderRadius: 15, cursor: "pointer", marginBottom: 12, color: "#1a1a22" }}>
            Upload Resume 
            <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} hidden />
          </label>

          <textarea placeholder="Paste resume..." value={resumeText} onChange={(e) => setResumeText(e.target.value)} style={{ width: "100%", height: 100, marginBottom: 12 }} />
          <textarea placeholder="Paste job description (optional)..." value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} style={{ width: "100%", height: 100, marginBottom: 12 }} />

          <button onClick={analyze}>Analyze ✧･ﾟ</button>

          {loading && <Loader />}
          {error && <p style={{ color: "#f87171", marginTop: 10 }}>{error}</p>}

          {/* Results */}
          {result && (
            <div style={{ marginTop: 20 }}>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {["score", "keywords", "bullets", "feedback"].map(t => (
                  <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                    {t === "score" && "✨ Score"}
                    {t === "keywords" && "🔍 Keywords"}
                    {t === "bullets" && "✏️ Bullets"}
                    {t === "feedback" && "💬 Feedback"}
                  </button>
                ))}
              </div>

              {/* Score Tab */}
              {tab === "score" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                    <ScoreRing score={result.ats_score} />
                    <div>
                      <p style={{ color: "#e6ccff", fontWeight: 500, marginBottom: 6 }}>
                        {result.ats_score >= 70 ? "Strong resume ✅" : result.ats_score >= 40 ? "Needs some work ⚠️" : "Needs major work ❌"}
                      </p>
                      <p style={{ color: "#aaa", fontSize: 13, lineHeight: 1.6 }}>{result.summary}</p>
                    </div>
                  </div>

                  {result.score_breakdown && (
                    <div style={card}>
                      <p style={{ color: "#e6ccff", marginBottom: 12, fontWeight: 500 }}>Score breakdown</p>
                      {Object.entries(result.score_breakdown).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                            <span style={{ color: "#e6ccff" }}>{v}/25</span>
                          </div>
                          <div style={{ height: 6, background: "#2a2a35", borderRadius: 3 }}>
                            <div style={{ height: "100%", width: `${(v / 25) * 100}%`, background: "linear-gradient(90deg, #e6ccff, #f8c8dc)", borderRadius: 3, transition: "width 1s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Keywords Tab */}
              {tab === "keywords" && (
                <div>
                  <div style={card}>
                    <p style={{ color: "#6ee7b7", marginBottom: 10, fontWeight: 500 }}>✅ Matched keywords</p>
                    <div>
                      {result.matched_keywords?.length ? result.matched_keywords.map((kw, i) => (
                        <span key={i} className="keyword-tag" style={{ background: "#6ee7b722", color: "#6ee7b7", border: "1px solid #6ee7b755" }}>{kw}</span>
                      )) : <p style={{ color: "#aaa", fontSize: 13 }}>No job description provided</p>}
                    </div>
                  </div>
                  <div style={card}>
                    <p style={{ color: "#f87171", marginBottom: 10, fontWeight: 500 }}>❌ Missing keywords</p>
                    <div>
                      {result.missing_keywords?.length ? result.missing_keywords.map((kw, i) => (
                        <span key={i} className="keyword-tag" style={{ background: "#f8717122", color: "#f87171", border: "1px solid #f8717155" }}>{kw}</span>
                      )) : <p style={{ color: "#aaa", fontSize: 13 }}>None missing</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Bullets Tab */}
              {tab === "bullets" && (
                <div>
                  {result.improved_bullets?.map((b, i) => (
                    <div key={i} style={card}>
                      <p style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>ORIGINAL</p>
                      <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6, marginBottom: 10 }}>{b.original}</p>
                      <div style={{ height: 1, background: "#2a2a35", margin: "10px 0" }} />
                      <p style={{ color: "#e6ccff", fontSize: 12, marginBottom: 4 }}>IMPROVED ✨</p>
                      <p style={{ fontSize: 13, color: "white", lineHeight: 1.6 }}>{b.improved}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback Tab */}
              {tab === "feedback" && (
                <div>
                  <div style={card}>
                    <p style={{ color: "#6ee7b7", marginBottom: 12, fontWeight: 500 }}>💪 Strengths</p>
                    {result.strengths?.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                        <span style={{ color: "#6ee7b7" }}>→</span>
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#ccc" }}>{s}</p>
                      </div>
                    ))}
                  </div>
                  <div style={card}>
                    <p style={{ color: "#fbbf24", marginBottom: 12, fontWeight: 500 }}>🔧 Improvements</p>
                    {result.improvements?.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                        <span style={{ color: "#fbbf24" }}>→</span>
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#ccc" }}>{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </>
  );
}