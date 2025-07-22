import cron from "node-cron";
import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import fs from 'fs';
dotenv.config();

export async function runJobSearch() {
  console.log("Running job search...");

  const dateStr = new Date().toLocaleDateString('en-IN');
  const keywords = JSON.parse(fs.readFileSync('keywords.json'));
  let allResults = "";
  const sentJobsFile = 'sentJobs.json';
  let sentJobs = fs.existsSync(sentJobsFile) ? JSON.parse(fs.readFileSync(sentJobsFile)) : [];

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  // Pretend to be a real browser
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  // Naukri scraping
  try {
for (const keyword of keywords) {
  const url = `https://www.naukri.com/${encodeURIComponent(keyword)}-jobs-in-india-0-to-3-years`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    await new Promise(r => setTimeout(r, 8000)); // wait for hydration

    const jobs = await page.evaluate(() => {
      const jobLinks = document.querySelectorAll("a.title");
      const results = [];
      for (let i = 0; i < Math.min(5, jobLinks.length); i++) {
        const linkElem = jobLinks[i];
        const title = linkElem?.innerText?.trim();
        const link = linkElem?.href;
        if (title && link) {
          results.push({ title, link });
        }
      }
      return results;
    });

    const filteredJobs = jobs.filter(job => !sentJobs.includes(job.link));

    if (filteredJobs.length === 0) {
      allResults += `\n🟢 ${keyword} — Naukri\n- No new jobs found\n`;
    } else {
      for (const job of filteredJobs) {
        allResults += `- ${job.title} → ${job.link}\n`;
        sentJobs.push(job.link);
      }
    }

  } catch (err) {
    console.error(`Error scraping Naukri for ${keyword}:`, err.message);
    allResults += `\n🟢 ${keyword} — Naukri\n- Error fetching jobs\n`;
  }

  await new Promise(r => setTimeout(r, 2000)); // polite pause
}



    // Linkedin scraping
for (const keyword of keywords) {
  try {
    await page.goto(
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=India&f_E=2`,
      { waitUntil: "networkidle2" }
    );

    const linkedInJobs = await page.evaluate(() => {
      const jobs = [];
      const jobTitles = document.querySelectorAll(".base-search-card__title");
      const jobLinks = document.querySelectorAll(".base-card__full-link");

      for (let i = 0; i < Math.min(5, jobTitles.length); i++) {
        const title = jobTitles[i]?.innerText.trim();
        const link = jobLinks[i]?.href;
        if (title && link) {
          jobs.push({ title, link });
        }
      }
      return jobs;
    });

    const filteredJobs = linkedInJobs.filter(job => !sentJobs.includes(job.link));

    if (filteredJobs.length === 0) {
      allResults += `\n🔵 ${keyword} — LinkedIn\n- No new jobs found\n`;
    } else {
      for (const job of filteredJobs) {
        allResults += `- ${job.title} → ${job.link}\n`;
        sentJobs.push(job.link);
      }
    }

    await delay(2000);

  } catch (error) {
    console.error(`Error scraping LinkedIn for ${keyword}:`, error.message);
    allResults += `\n🔵 ${keyword} — LinkedIn\n- Error fetching jobs\n`;
    await delay(2000);
  }
}


    // Google Search URLs
    for (const keyword of keywords) {
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword + " jobs")}`;
      allResults += `\n🟡 ${keyword} — Google Search\n- ${googleUrl}\n`;
      await delay(2000);
    }

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
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
        subject: `Daily Job Search - ${dateStr}`,
        text: `Here are your daily job listings:\n${allResults}`
      });

      console.log("Email sent!");
      fs.writeFileSync(sentJobsFile, JSON.stringify(sentJobs.slice(-5000), null, 2));

    } catch (err) {
      console.error("Error sending email:", err.message);
    }

  } catch (err) {
    console.error("Scraping failed:", err);
  } finally {
    await browser.close();
  }

}

// Schedule the job
cron.schedule("42 20 * * *", runJobSearch, {
  timezone: "Asia/Kolkata"
});

