import * as vscode from 'vscode';
import fetch from 'node-fetch';  // For making HTTP requests
import { Message } from '../types';
import { AILogger } from '../utils/logger';
import { BASE_SYSTEM_PROMPT } from '../utils/base-prompts';

/**
 * Provider class that communicates with DeepSeek API
 */
export class DeepSeekProvider {
    private logger: AILogger;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
    }
    
    /**
     * Sends a request to DeepSeek API
     */
    public async callDeepSeek(userMessage: string, messages: Message[]): Promise<string> {
        let apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('DeepSeek API key not found. Please configure it.');
        }
        
        const formattedMessages = this.formatMessages(messages);
        formattedMessages.push({ role: 'system', content: userMessage });
        this.logger.log('Sending DeepSeek API request...');
        
        try {
            const config = vscode.workspace.getConfiguration('byte');
            const model = config.get<string>('deepseek.model') || 'deepseek-chat';
            this.logger.log(`model ${model}`);
            const response = await fetch('https://api.deepseek.com', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: formattedMessages,
                    temperature: 0.7
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`DeepSeek API Error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            const assistantResponse = data.choices[0].message.content;
            
            this.logger.log('DeepSeek API response received');
            return assistantResponse;
        } catch (error: any) {
            
            this.logger.log(`DeepSeek API Error: ${error.message}`, true);
            throw new Error(`DeepSeek API request failed: ${error.message}`);
        }
    }
    
    /**
     * Converts messages to DeepSeek API format
     */
    private formatMessages(messages: Message[]): any[] {
        const formattedMessages = [
            { 
                role: 'system', 
                content: BASE_SYSTEM_PROMPT
            }
        ];
        
        const recentMessages = messages.slice(-10);  // Limit to the most recent 10 messages
        recentMessages.forEach(message => {
            formattedMessages.push({
                role: message.role,
                content: message.content
            });
        });
        
        return formattedMessages;
    }
    
    /**
     * Gets DeepSeek API key from secure storage
     */
    public async getApiKey(): Promise<string | undefined> {
        let apiKey = await this.context.secrets.get('byte.deepseek.apiKey');
        
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('byte');
            apiKey = config.get<string>('deepseek.apiKey');
        }
        
        return apiKey;
    }
    
    /**
     * Saves DeepSeek API key to secure storage
     */
    public async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('byte.deepseek.apiKey', apiKey);
        this.logger.log('DeepSeek API key saved to secure storage');
    }
}
