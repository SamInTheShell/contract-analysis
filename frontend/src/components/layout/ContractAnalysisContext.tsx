import React, { createContext, useContext, useState, useRef } from 'react';
import type { ReactNode } from 'react';

export type ChatMessage = { text: string; sender: 'user' | 'llm' };

export type ContractAnalysisContextType = {
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    isWaitingForResponse: boolean;
    setIsWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>;
    failureMessage: string | null;
    setFailureMessage: React.Dispatch<React.SetStateAction<string | null>>;
    sendMessage: (msg: string) => void;
    wsConnected: boolean;
    wsConnecting: boolean;
    extractedText: string | null;
    setExtractedText: React.Dispatch<React.SetStateAction<string | null>>;
    startChatSession: (contractText: string, firstMessage: string) => void;
};

const ContractAnalysisContext = createContext<ContractAnalysisContextType | undefined>(undefined);

export const useContractAnalysis = () => {
    const ctx = useContext(ContractAnalysisContext);
    if (!ctx) throw new Error('useContractAnalysis must be used within ContractAnalysisProvider');
    return ctx;
};

export const ContractAnalysisProvider = ({ children }: { children: ReactNode }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
    const [failureMessage, setFailureMessage] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [wsConnecting, setWsConnecting] = useState(false);

    const startChatSession = (contractText: string, firstMessage: string) => {
        setWsConnecting(true);
        setFailureMessage(null);
        setIsWaitingForResponse(true);
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.host;
        const wsUrl = `${protocol}://${host}/api/v1/doc-analysis`;
        const ws = new window.WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
            setWsConnected(true);
            setWsConnecting(false);
            ws.send(contractText);
            ws.send(firstMessage);
        };
        ws.onclose = (event) => {
            setWsConnected(false);
            setWsConnecting(false);
            if (!event.wasClean) {
                setFailureMessage('Unable to connect to the server. Please try again later.');
            }
        };
        ws.onerror = () => {
            setWsConnecting(false);
            if (!wsConnected) {
                setFailureMessage('Unable to connect to the server. Please try again later.');
            }
        };
        ws.onmessage = (event) => {
            const data = event.data?.trim();
            if (!data) return;
            if (data.startsWith('Contract received:')) return;
            if (data.startsWith('Invalid request:')) return;
            if (data === 'Error contacting LLM API.') return;
            // Streaming: accumulate LLM response
            setMessages(msgs => {
                // If last message is from llm, append; else, add new
                if (msgs.length > 0 && msgs[msgs.length - 1].sender === 'llm') {
                    const updated = [...msgs];
                    updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        text: updated[updated.length - 1].text + data
                    };
                    return updated;
                } else {
                    return [...msgs, { text: data, sender: 'llm' }];
                }
            });
            setIsWaitingForResponse(false);
        };
    };

    const sendMessage = (msg: string) => {
        setIsWaitingForResponse(true);
        setMessages(msgs => [...msgs, { text: msg, sender: 'user' }]);
        if (wsRef.current && wsRef.current.readyState === window.WebSocket.OPEN) {
            wsRef.current.send(msg);
        } else {
            setFailureMessage('WebSocket not connected');
            setIsWaitingForResponse(false);
        }
    };

    return (
        <ContractAnalysisContext.Provider value={{
            input,
            setInput,
            messages,
            setMessages,
            isWaitingForResponse,
            setIsWaitingForResponse,
            failureMessage,
            setFailureMessage,
            sendMessage,
            wsConnected,
            wsConnecting,
            extractedText,
            setExtractedText,
            startChatSession
        }}>
            {children}
        </ContractAnalysisContext.Provider>
    );
};
