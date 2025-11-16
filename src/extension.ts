import * as vscode from 'vscode';
import { EnvManager } from './environment/manager';
import { registerAllCommands } from './commands';
import { setupVisualDebuggerWebview } from './webview/visualDebugger';
import { LspManager } from './lsp/lsp_manager';
import { JacDefinitionProvider, JacSemanticTokensProvider, JacDiagnosticSuppressor } from './providers';

let lspManager: LspManager | undefined;

export function getLspManager(): LspManager | undefined {
    return lspManager;
}

export async function activate(context: vscode.ExtensionContext) {
    try {
        const envManager = new EnvManager(context);
        registerAllCommands(context, envManager);
        await envManager.init();

        setupVisualDebuggerWebview(context);

        lspManager = new LspManager(envManager);
        await lspManager.start();

        // Register the Jac definition provider for Python files (if enabled)
        const config = vscode.workspace.getConfiguration('jaclang-extension');
        const enableJacDefinitionProvider = config.get<boolean>('enableJacDefinitionProvider', true);
        const enableSemanticHighlighting = config.get<boolean>('enableSemanticHighlighting', true);
        const suppressPylanceDiagnostics = config.get<boolean>('suppressPylanceDiagnostics', true);
        
        if (enableJacDefinitionProvider) {
            // Definition provider
            const jacDefinitionProvider = new JacDefinitionProvider();
            context.subscriptions.push(
                vscode.languages.registerDefinitionProvider(
                    { language: 'python', scheme: 'file' },
                    jacDefinitionProvider
                )
            );
        }

        if (enableSemanticHighlighting) {
            // Semantic tokens provider for highlighting Jac imports
            const jacSemanticTokensProvider = new JacSemanticTokensProvider();
            context.subscriptions.push(
                vscode.languages.registerDocumentSemanticTokensProvider(
                    { language: 'python', scheme: 'file' },
                    jacSemanticTokensProvider,
                    jacSemanticTokensProvider.getTokensLegend()
                )
            );
        }

        if (suppressPylanceDiagnostics) {
            // Diagnostic suppressor for Pylance missing import errors
            const jacDiagnosticSuppressor = new JacDiagnosticSuppressor();
            context.subscriptions.push(jacDiagnosticSuppressor);
        }

        context.subscriptions.push({
            dispose: () => lspManager?.stop()
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate Jac extension: ${error}`);
        console.error('Extension activation error:', error);
    }
}

export function deactivate(): Thenable<void> | undefined {
    return lspManager?.stop();
}
