process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import puppeteer from 'puppeteer';
import fs from 'fs';
import fsPromises from 'fs/promises';
import axios from 'axios';

const seasonLink = 'http://griffiny.ru/season-22/';
const seasonName = 'Сезон 22';

const episodes = [];

(async () => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();

  // Navigate the page to a URL
  await page.goto(seasonLink);

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 });

  const watchList = await page.waitForSelector('#dle-content');

  const watchListElements = await watchList.$$('.anonse_footer a');

  for (let element of watchListElements) {
    let episodeName = (await element.evaluate(el => el.textContent)).replace('Смотреть ', '').trim();
    let episodeLink = await element.evaluate(el => el.href);
    episodes.push({ name: episodeName, link: episodeLink });
  }

  await fsPromises.mkdir(`${seasonName}`, { recursive: true });
  for (let episode of episodes) {
    await page.goto(episode.link);
    const frame =await page.waitForSelector('iframe');
    const contentFrame = await frame.contentFrame();
    const video = await contentFrame.$$('video > source');
    const videoLink = await video[0].evaluate(el => el.src);
    const videoName = `${episode.name}.mp4`.replace(/[/\\?%*:|"<>]/g, '.');
    const userAgent = await page.evaluate(() => navigator.userAgent);
    try {
      const videoStream = await axios({
        method: "get",
        url: videoLink,
        responseType: "stream",
        headers: {
          'User-Agent': userAgent
        }
      });
      const file = `${seasonName}/${videoName}`
      try {
        await fsPromises.access(file, fs.constants.F_OK);
        console.log(`File exists: ${file}`);
        continue;
      } catch (err) { }
      videoStream.data.pipe(fs.createWriteStream(file));
      await new Promise((resolve, reject) => {
        videoStream.data.on('end', () => {
          console.log(`Downloaded: ${file}`);
          resolve();
        });
        videoStream.data.on('error', () => {
          reject();
        });
      });
    } catch (e) {
      console.log(e);
    }
  }

  await browser.close();
})();