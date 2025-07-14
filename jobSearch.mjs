import cron from "node-cron";
import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export async function runJobSearch() {
  console.log("Running job search...");

  const keywords = [
    "React developer",
    "NodeJS developer",
    "MongoDB developer",
    "MERN stack",
    "Full Stack Developer",
    "JavaScript developer"
  ];

  let allResults = "";

  // Naukri scraping
  for (const keyword of keywords) {
    const url = `https://www.naukri.com/${encodeURIComponent(keyword)}-jobs`;

    try {
      await page.goto(url, { waitUntil: "networkidle2" });

      const jobs = await page.evaluate(() => {
        const jobCards = document.querySelectorAll(".jobTuple");
        const results = [];
        jobCards.forEach((card, i) => {
          if (i >= 3) return;
          const titleElem = card.querySelector(".title");
          const title = titleElem?.innerText.trim();
          const link = titleElem?.href;
          if (title && link) {
            results.push(`- ${title} → ${link}`);
          }
        });
        return results;
      });

      allResults += `\n🟢 ${keyword} — Naukri\n${jobs.join("\n")}\n`;
    } catch (err) {
      console.error(`Error scraping Naukri for ${keyword}:`, err.message);
      allResults += `\n🟢 ${keyword} — Naukri\n- Error fetching jobs\n`;
    }
  }

  // LinkedIn scraping using Puppeteer
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  for (const keyword of keywords) {
    try {
      await page.goto(
        `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}`,
        { waitUntil: "networkidle2" }
      );

      const linkedInJobs = await page.evaluate(() => {
        const results = [];
        const jobs = document.querySelectorAll(".base-search-card__title");
        const links = document.querySelectorAll(".base-card__full-link");
        for (let i = 0; i < Math.min(3, jobs.length); i++) {
          const title = jobs[i]?.innerText.trim();
          const link = links[i]?.href;
          results.push(`- ${title} → ${link}`);
        }
        return results;
      });

      allResults += `\n🔵 ${keyword} — LinkedIn\n${linkedInJobs.join("\n")}\n`;
    } catch (error) {
      console.error(`Error scraping LinkedIn for ${keyword}:`, error.message);
      allResults += `\n🔵 ${keyword} — LinkedIn\n- Error fetching jobs\n`;
    }
  }

  await browser.close();

  // Google Search URLs
  for (const keyword of keywords) {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword + " jobs")}`;
    allResults += `\n🟡 ${keyword} — Google Search\n- ${googleUrl}\n`;
  }

  function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      return res;
    } catch (err) {
      if (i === retries - 1) throw err; // last try: rethrow
      await delay(delayMs); // wait before retry
    }
  }
}



  // Send email
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "susmithagopireddy26@gmail.com",
      subject: "Daily Job Search",
      text: `Here are your daily job listings:\n${allResults}`
    });

    console.log("Email sent!");
  } catch (err) {
    console.error("Error sending email:", err.message);
  }
}

// Schedule the job
cron.schedule("30 15 * * *", runJobSearch); // 8:30 PM IST

