/*
 * Jest tests for inspectTokenScopesHandler functionality in VSCode extension.
 * Uses real vscode-textmate and vscode-oniguruma libraries for actual grammar testing.
 */

import * as path from 'path';
import * as fs from 'fs';
import { tokenizeContent } from '../commands/inspectTokenScopes';

// Read the actual app.jac file
const appJacPath = path.join(process.cwd(), 'examples', 'app.jac');
const appJacContent = fs.readFileSync(appJacPath, 'utf-8');

// Paths for grammar and wasm
const grammarPath = path.join(process.cwd(), 'syntaxes', 'jac.tmLanguage.json');
const wasmPath = path.join(process.cwd(), 'node_modules', 'vscode-oniguruma', 'release', 'onig.wasm');

describe('inspectTokenScopesHandler', () => {
  test('should tokenize Jac keywords correctly', async () => {
    const tokenMap = await tokenizeContent(appJacContent, grammarPath, wasmPath);

    // Check 'with' keyword (storage.type.function.jac)
    const withScopes = tokenMap.get('with');
    expect(withScopes).toBeDefined();
    expect(withScopes).toContain('source.jac');
    expect(withScopes).toContain('storage.type.function.jac');

    // Check 'entry' keyword
    const entryScopes = tokenMap.get('entry');
    expect(entryScopes).toBeDefined();
    expect(entryScopes).toContain('keyword.control.flow.jac');

    // Check 'lambda' keyword
    const lambdaScopes = tokenMap.get('lambda');
    expect(lambdaScopes).toBeDefined();
    expect(lambdaScopes).toContain('keyword.control.flow.jac');

    // Check 'print' builtin
    const printScopes = tokenMap.get('print');
    expect(printScopes).toBeDefined();
    expect(printScopes).toContain('support.function.builtin.jac');
  });

  test('should tokenize JSX elements correctly', async () => {
    const tokenMap = await tokenizeContent(appJacContent, grammarPath, wasmPath);

    // Check that we have JSX-related tokens
    const allScopes = Array.from(tokenMap.values()).flat();

    // Check for meta.jsx scope or entity.name.tag for JSX elements
    const hasJsxScopes = allScopes.some(s =>
      s.includes('jsx') ||
      s.includes('entity.name.tag') ||
      s.includes('punctuation.definition.tag')
    );
    expect(hasJsxScopes).toBe(true);

    // Check specific JSX HTML tags
    const divScopes = tokenMap.get('div');
    expect(divScopes).toBeDefined();
    expect(divScopes).toContain('entity.name.tag.html.jsx.jac');

    const h1Scopes = tokenMap.get('h1');
    expect(h1Scopes).toBeDefined();
    expect(h1Scopes).toContain('entity.name.tag.html.jsx.jac');

    const buttonScopes = tokenMap.get('button');
    expect(buttonScopes).toBeDefined();
    expect(buttonScopes).toContain('entity.name.tag.html.jsx.jac');

    // Check JSX attributes
    const onClickScopes = tokenMap.get('onClick');
    expect(onClickScopes).toBeDefined();
    expect(onClickScopes).toContain('entity.other.attribute-name.jsx.jac');

    // Check PascalCase component names
    const buttonComponentScopes = tokenMap.get('ButtonComponent');
    expect(buttonComponentScopes).toBeDefined();
    expect(buttonComponentScopes).toContain('support.class.component.jsx.jac');

    const navLinkScopes = tokenMap.get('NavLink');
    expect(navLinkScopes).toBeDefined();
    expect(navLinkScopes).toContain('support.class.component.jsx.jac');
  });
});
