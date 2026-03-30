import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

console.log("Server started...");
console.log("API KEY found:", process.env.GROQ_API_KEY ? "YES" : "NO — check your .env file");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/analyze", async (req, res) => {
  const { resumeText, jobDescription } = req.body;

  if (!resumeText) {
    return res.status(400).json({ error: "Resume text is required" });
  }

  const prompt = `You are an expert ATS (Applicant Tracking System) resume analyzer and career coach.

Analyze the following resume against the job description provided.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription || "Not provided — do a general analysis."}

Respond ONLY with a valid JSON object (no markdown, no explanation) in this exact structure:
{
  "ats_score": <number 0-100>,
  "score_breakdown": {
    "keyword_match": <0-25>,
    "formatting": <0-25>,
    "relevance": <0-25>,
    "completeness": <0-25>
  },
  "matched_keywords": ["keyword1", "keyword2"],
  "missing_keywords": ["keyword1", "keyword2"],
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "improved_bullets": [
    {
      "original": "original bullet point from resume",
      "improved": "rewritten version with stronger action verbs, metrics, impact"
    }
  ],
  "summary": "2-3 sentence overall assessment"
}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are an ATS resume analyzer. You ONLY respond with valid JSON, nothing else." },
          { role: "user", content: prompt }
        ],
        temperature: 0,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(500).json({ error: "Groq API error", details: data });
    }

    const raw = data.choices?.[0]?.message?.content || "";
    console.log("Raw response:", raw);

    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json(parsed);

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error. Could not analyze resume." });
  }
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));