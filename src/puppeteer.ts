import originalPuppeteer from 'puppeteer-core';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const puppeteer = addExtra(originalPuppeteer);
puppeteer.use(StealthPlugin());

export { puppeteer };
