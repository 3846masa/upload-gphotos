import { Parser as XMLParser } from 'xml2js';
import pify from 'pify';

class XMLParserPromise extends XMLParser {
  constructor (...args) {
    super(...args);
  }

  parseString (...args) {
    return pify(super.parseString)(...args);
  }
}

export default XMLParserPromise;
