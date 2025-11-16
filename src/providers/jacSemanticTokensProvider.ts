import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class JacSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    
    private readonly tokensLegend = new vscode.SemanticTokensLegend(
        ['jacModule'],  // Token types
        ['resolved']    // Token modifiers
    );

    getTokensLegend(): vscode.SemanticTokensLegend {
        return this.tokensLegend;
    }

    /**
     * Provide semantic tokens for Python files to highlight Jac module imports
     */
    async provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens | null> {
        
        // Only handle Python files
        if (document.languageId !== 'python') {
            return null;
        }

        if (token.isCancellationRequested) {
            return null;
        }

        const builder = new vscode.SemanticTokensBuilder(this.tokensLegend);
        const text = document.getText();
        const lines = text.split('\n');

        // Debug logging
        const config = vscode.workspace.getConfiguration('jaclang-extension');
        const developerMode = config.get<boolean>('developerMode', false);

        if (developerMode) {
            vscode.window.showInformationMessage('Jac: Processing semantic tokens for Python file');
        }

        let tokenCount = 0;
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (token.isCancellationRequested) {
                break;
            }

            const line = lines[lineIndex];
            const lineTokenCount = await this.processLine(document, line, lineIndex, builder);
            tokenCount += lineTokenCount;
        }

        if (developerMode && tokenCount > 0) {
            vscode.window.showInformationMessage(`Jac: Generated ${tokenCount} semantic tokens`);
        }

        const semanticTokens = builder.build();
        return semanticTokens;
    }

    /**
     * Process a single line to find and highlight Jac module imports
     * Returns the number of tokens added
     */
    private async processLine(
        document: vscode.TextDocument,
        lineText: string,
        lineIndex: number,
        builder: vscode.SemanticTokensBuilder
    ): Promise<number> {
        
        let tokenCount = 0;
        
        // Patterns to match different import styles
        const patterns = [
            // import module [as alias]
            { regex: /^(\s*)import\s+([\w\.]+)(\s+as\s+\w+)?/, moduleGroup: 2 },
            // from module import ...
            { regex: /^(\s*)from\s+([\w\.]+)\s+import/, moduleGroup: 2 },
            // Multi-import: import module1, module2
            { regex: /^(\s*)import\s+([\w\.\s,]+)/, moduleGroup: 2, isMulti: true }
        ];

        for (const pattern of patterns) {
            const match = lineText.match(pattern.regex);
            if (match) {
                if (pattern.isMulti) {
                    // Handle multi-import case
                    tokenCount += await this.processMultiImport(document, lineText, lineIndex, match, builder);
                } else {
                    // Handle single import case
                    tokenCount += await this.processSingleImport(document, lineText, lineIndex, match[pattern.moduleGroup], builder);
                }
                break; // Only process first matching pattern
            }
        }
        
        return tokenCount;
    }

    /**
     * Process multi-import statements (e.g., import module1, module2)
     */
    private async processMultiImport(
        document: vscode.TextDocument,
        lineText: string,
        lineIndex: number,
        match: RegExpMatchArray,
        builder: vscode.SemanticTokensBuilder
    ): Promise<number> {
        
        let tokenCount = 0;
        const modulesText = match[2];
        const modules = modulesText.split(',').map(m => m.trim());
        let searchStart = match[0].indexOf(modulesText);

        for (const moduleName of modules) {
            if (!moduleName) continue;

            const moduleStart = lineText.indexOf(moduleName, searchStart);
            if (moduleStart !== -1) {
                // Check if this module resolves to a Jac file
                const isJacModule = await this.isJacModule(document.uri, moduleName);
                if (isJacModule) {
                    builder.push(
                        lineIndex,
                        moduleStart,
                        moduleName.length,
                        this.tokensLegend.tokenTypes.indexOf('jacModule'),
                        this.tokensLegend.tokenModifiers.indexOf('resolved')
                    );
                    tokenCount++;
                }
                searchStart = moduleStart + moduleName.length;
            }
        }
        
        return tokenCount;
    }

    /**
     * Process single import statements
     */
    private async processSingleImport(
        document: vscode.TextDocument,
        lineText: string,
        lineIndex: number,
        moduleName: string,
        builder: vscode.SemanticTokensBuilder
    ): Promise<number> {
        
        const moduleStart = lineText.indexOf(moduleName);
        if (moduleStart !== -1) {
            // Check if this module resolves to a Jac file
            const isJacModule = await this.isJacModule(document.uri, moduleName);
            if (isJacModule) {
                builder.push(
                    lineIndex,
                    moduleStart,
                    moduleName.length,
                    this.tokensLegend.tokenTypes.indexOf('jacModule'),
                    this.tokensLegend.tokenModifiers.indexOf('resolved')
                );
                return 1;
            }
        }
        
        return 0;
    }

    /**
     * Check if a module name resolves to a Jac file
     */
    private async isJacModule(documentUri: vscode.Uri, moduleName: string): Promise<boolean> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        if (!workspaceFolder) {
            return false;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        const documentDir = path.dirname(documentUri.fsPath);
        
        // Convert module name to file path
        const modulePath = moduleName.split('.')[0]; // Take only the first part for now
        
        // Search locations
        const searchPaths = [
            // Relative to current file
            path.resolve(documentDir, `${modulePath}.jac`),
            path.resolve(documentDir, modulePath, 'index.jac'),
            path.resolve(documentDir, modulePath, '__init__.jac'),
            
            // Relative to workspace root
            path.resolve(workspaceRoot, `${modulePath}.jac`),
            path.resolve(workspaceRoot, modulePath, 'index.jac'),
            path.resolve(workspaceRoot, modulePath, '__init__.jac'),
            
            // Common source directories
            path.resolve(workspaceRoot, 'src', `${modulePath}.jac`),
            path.resolve(workspaceRoot, 'lib', `${modulePath}.jac`),
        ];

        // Check each path
        for (const jacPath of searchPaths) {
            if (await this.fileExists(jacPath)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a file exists
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            const stat = await fs.promises.stat(filePath);
            return stat.isFile();
        } catch {
            return false;
        }
    }
}