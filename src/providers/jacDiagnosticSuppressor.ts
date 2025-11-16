import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class JacDiagnosticSuppressor {
    private disposables: vscode.Disposable[] = [];
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('jacPythonSuppress');
        this.registerDiagnosticListener();
    }

    /**
     * Register listener for diagnostic changes to suppress Pylance missing import errors for Jac modules
     */
    private registerDiagnosticListener(): void {
        // Listen to diagnostic changes with a delay to avoid conflicts
        const diagnosticListener = vscode.languages.onDidChangeDiagnostics(async (event) => {
            for (const uri of event.uris) {
                const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
                if (document && document.languageId === 'python') {
                    // Add a small delay to let Pylance finish processing
                    setTimeout(async () => {
                        await this.processPythonFileDiagnostics(uri);
                    }, 500);
                }
            }
        });

        this.disposables.push(diagnosticListener);
    }

    /**
     * Process diagnostics for a Python file and suppress missing import errors for Jac modules
     */
    private async processPythonFileDiagnostics(uri: vscode.Uri): Promise<void> {
        const allDiagnostics = vscode.languages.getDiagnostics();
        const fileDiagnostics = vscode.languages.getDiagnostics(uri);
        
        if (!fileDiagnostics || fileDiagnostics.length === 0) {
            return;
        }

        let shouldClearDiagnostics = false;
        const suppressedDiagnostics: vscode.Diagnostic[] = [];

        for (const diagnostic of fileDiagnostics) {
            if (this.isPylanceMissingImportError(diagnostic)) {
                const moduleName = this.extractModuleNameFromDiagnostic(diagnostic);
                if (moduleName) {
                    const isJacModule = await this.isJacModule(uri, moduleName);
                    if (isJacModule) {
                        // Create a diagnostic to override Pylance's diagnostic
                        const suppressingDiagnostic = new vscode.Diagnostic(
                            diagnostic.range,
                            `Jac module "${moduleName}" found`,
                            vscode.DiagnosticSeverity.Information
                        );
                        suppressingDiagnostic.source = 'Jac Extension';
                        suppressedDiagnostics.push(suppressingDiagnostic);
                        shouldClearDiagnostics = true;
                    }
                }
            }
        }

        if (shouldClearDiagnostics) {
            // Set our own diagnostics to override the problematic ones
            this.diagnosticCollection.set(uri, suppressedDiagnostics);
        } else {
            // Clear our diagnostics if no suppression needed
            this.diagnosticCollection.delete(uri);
        }
    }

    /**
     * Check if a diagnostic is a Pylance missing import error
     */
    private isPylanceMissingImportError(diagnostic: vscode.Diagnostic): boolean {
        const message = diagnostic.message.toLowerCase();
        const source = diagnostic.source?.toLowerCase() || '';
        
        return (
            (source.includes('pylance') || source.includes('pyright')) &&
            (
                message.includes('could not be resolved') ||
                message.includes('reportmissingimports') ||
                (message.includes('import') && message.includes('could not')) ||
                message.includes('is not defined')
            )
        );
    }

    /**
     * Extract module name from Pylance missing import diagnostic message
     */
    private extractModuleNameFromDiagnostic(diagnostic: vscode.Diagnostic): string | null {
        const message = diagnostic.message;
        
        // Pattern: Import "module" could not be resolved
        const importPattern = /Import\s+"([^"]+)"\s+could\s+not\s+be\s+resolved/i;
        const match = message.match(importPattern);
        
        if (match && match[1]) {
            return match[1];
        }

        // Alternative pattern: "module" is not defined
        const notDefinedPattern = /"([^"]+)"\s+is\s+not\s+defined/i;
        const notDefinedMatch = message.match(notDefinedPattern);
        
        if (notDefinedMatch && notDefinedMatch[1]) {
            return notDefinedMatch[1];
        }

        // Another pattern: No module named 'module'
        const noModulePattern = /No\s+module\s+named\s+['""]([^'"'"]+)['"'"]/i;
        const noModuleMatch = message.match(noModulePattern);
        
        if (noModuleMatch && noModuleMatch[1]) {
            return noModuleMatch[1];
        }

        return null;
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
        const modulePath = moduleName.split('.')[0]; // Take only the first part
        
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

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.diagnosticCollection.dispose();
    }
}