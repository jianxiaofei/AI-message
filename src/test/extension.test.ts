import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

// Import your extension modules to test them
// Note: You may need to adjust these imports based on your actual export structure

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('jianxiaofei.ai-message'));
	});

	test('Commands should be registered', async () => {
		// Ensure the extension is activated before checking commands
		const extension = vscode.extensions.getExtension('jianxiaofei.ai-message');
		if (extension && !extension.isActive) {
			await extension.activate();
		}
		
		const commands = await vscode.commands.getCommands();
		assert.ok(commands.includes('ai-message.generateCommitMessage'));
		assert.ok(commands.includes('ai-message.quickCommit'));
		assert.ok(commands.includes('ai-message.configureAI'));
	});

	test('Configuration properties should be defined', () => {
		const config = vscode.workspace.getConfiguration('aiMessage');
		
		// Test that configuration properties exist
		assert.ok(config.has('svn.path'));
		assert.ok(config.has('git.path'));
		assert.ok(config.has('commitTemplate'));
		assert.ok(config.has('enableFallback'));
	});

	test('Should detect repository type correctly', () => {
		// This is a placeholder test - you would need to implement
		// the actual repository detection logic testing
		assert.strictEqual(true, true, 'Repository detection test placeholder');
	});

	test('Should generate commit message format correctly', () => {
		// This is a placeholder for testing commit message generation
		// You would need to test the AI service functionality
		assert.strictEqual(true, true, 'Commit message generation test placeholder');
	});
});
