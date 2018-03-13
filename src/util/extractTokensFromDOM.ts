import * as cheerio from 'cheerio';
import { AssignmentExpression } from 'estree';
import * as esprima from 'esprima';
import staticEval = require('static-eval');
import esrecurse = require('esrecurse');
import escodegen = require('escodegen');

export interface Tokens {
  SNlM0e?: string;
  S06Grb?: string;
}

export default function extractTokensFromDOM(html: string) {
  const $ = cheerio.load(html);
  const string = $('script')
    .map((_, el) => $(el).html())
    .get()
    .join(';\n');
  const ast = esprima.parseScript(string);

  let tokens = {};
  const visitor = new esrecurse.Visitor({
    AssignmentExpression(node: AssignmentExpression) {
      const left = escodegen.generate(node.left);
      if (left === 'window.WIZ_global_data') {
        tokens = staticEval(node.right, {});
      }
    },
  });
  visitor.visit(ast);

  return tokens as Tokens;
}
