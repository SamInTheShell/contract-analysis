import { useState, useRef, useEffect } from 'react';
import { Box, Typography, Paper, TextField, Button, List, ListItem, ListItemIcon, ListItemText, IconButton, Collapse, CircularProgress } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import aboutMd from './about.md?raw';
import privacyMd from './privacy.md?raw';
import tosMd from './tos.md?raw';
import { useContractAnalysis } from '../layout/ContractAnalysisContext';
import { useWaitingMessageCycler } from '../../utils/phrases';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeBlock = ({ language, codeText }: { language: string, codeText: string }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(codeText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <Box sx={{ position: 'relative', my: 1.5, background: '#282c34', borderRadius: 1, overflow: 'hidden' }}>
            <Button
                size="small"
                onClick={handleCopy}
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    color: '#abb2bf',
                    background: 'rgba(255,255,255,0.1)',
                    '&:hover': {
                        background: 'rgba(255,255,255,0.2)',
                    },
                    textTransform: 'none',
                    fontSize: '0.8rem'
                }}
            >
                {isCopied ? 'Copied!' : 'Copy'}
            </Button>
            <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                showLineNumbers={true}
                wrapLines={true}
                lineNumberStyle={{ color: '#6b7280', fontSize: '0.8em' }}
                customStyle={{ margin: 0, padding: '16px', paddingTop: '40px' }}
            >
                {codeText}
            </SyntaxHighlighter>
        </Box>
    );
};

export default function HomePage() {
    const {
        input,
        setInput,
        messages,
        setMessages,
        isWaitingForResponse,
        setIsWaitingForResponse,
        failureMessage,
        sendMessage,
        wsConnected,
        wsConnecting,
        extractedText,
        setExtractedText,
        startChatSession
    } = useContractAnalysis();

    const [dragActive, setDragActive] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [filesLocked, setFilesLocked] = useState(false);
    const [showScrollBubble, setShowScrollBubble] = useState(false);
    const [modalOpen, setModalOpen] = useState<'about' | 'privacy' | 'tos' | null>(null);
    const [modalContent, setModalContent] = useState('');
    const [promptChips, setPromptChips] = useState([
        { label: 'Analyze key clauses', text: 'Analyze key clauses in this document.' },
        { label: 'Identify potential risks', text: 'Identify potential risks in this document.' },
        { label: 'Spot non-standard terms', text: 'Spot non-standard terms in this document.' }
    ]);
    const [showExtracted, setShowExtracted] = useState(false);
    const [collapsedDocs, setCollapsedDocs] = useState<{ [key: string]: boolean }>({});
    const [inputError, setInputError] = useState<string | null>(null);

    const waitingMessage = useWaitingMessageCycler(isWaitingForResponse);

    const handlePromptChipClick = (chipLabel: string, chipText: string) => {
        setInput(prev => prev ? prev + ' ' + chipText : chipText);
        setPromptChips(chips => chips.filter(chip => chip.label !== chipLabel));
    };

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatEndRef.current) {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        const handleScroll = () => {
            const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 24;
            setShowScrollBubble(!atBottom);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files);
            setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
        }
    };

    const handleRemoveFile = (idx: number) => {
        setSelectedFiles(files => files.filter((_, i) => i !== idx));
    };
    const handleClearAll = () => {
        setSelectedFiles([]);
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;
        if (messages.length === 0 && selectedFiles.length === 0) {
            setInputError('Please upload at least one document before sending your first message.');
            return;
        } else {
            setInputError(null);
        }
        if (messages.length === 0 && selectedFiles.length > 0) {
            let allText = '';
            let newCollapsed: { [key: string]: boolean } = {};
            for (const file of selectedFiles) {
                let text = '';
                if (file.type === 'application/pdf') {
                    const { extractPdfText, sanitizeText } = await import('../../utils/pdfUtils');
                    text = await extractPdfText(file);
                    text = sanitizeText(text);
                } else if (file.type.startsWith('text/')) {
                    const { sanitizeText } = await import('../../utils/pdfUtils');
                    text = await file.text();
                    text = sanitizeText(text);
                }
                if (file.type === 'application/pdf') {
                    allText += `--- ${file.name} (PDF) ---\n${text}\n`;
                    newCollapsed[file.name + 'PDF'] = true;
                } else if (file.type.startsWith('text/')) {
                    allText += `--- ${file.name} (${file.type.replace('text/', '').toUpperCase()}) ---\n${text}\n`;
                    newCollapsed[file.name + file.type.replace('text/', '').toUpperCase()] = true;
                }
            }
            setExtractedText(allText.trim());
            setCollapsedDocs(newCollapsed);
            setShowExtracted(false);
            setFilesLocked(true);
            // Start chat session: open WebSocket, send document, then first message
            // Add first message to messages so it appears in chat
            setMessages(msgs => [...msgs, { text: input, sender: 'user' }]);
            setIsWaitingForResponse(true);
            startChatSession(allText.trim(), input);
            setInput('');
            return;
        }
        // For subsequent messages
        setIsWaitingForResponse(true);
        sendMessage(input);
        setInput('');
    };

    const handleOpenModal = (type: 'about' | 'privacy' | 'tos') => {
        if (type === 'about') setModalContent(aboutMd);
        if (type === 'privacy') setModalContent(privacyMd);
        if (type === 'tos') setModalContent(tosMd);
        setModalOpen(type);
    };
    const handleCloseModal = () => setModalOpen(null);

    // Custom component for markdown horizontal rule
    // const MarkdownDivider = () => (
    //     <Box sx={{ my: 2, width: '100%' }}>
    //         <Box sx={{ borderBottom: '2px solid #1976d2', opacity: 0.25, width: '100%' }} />
    //     </Box>
    // );

    const markdownComponents = {
        p: ({ children }: { children?: import('react').ReactNode }) => <Typography variant="body2" component="div" sx={{ color: 'inherit', margin: 0, padding: 0 }}>{children}</Typography>,
        hr: () => <Box sx={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.5)', my: 2, borderRadius: 1 }} />,
        table: ({ node, ...props }: { node?: any, children?: import('react').ReactNode }) => (
            <Box sx={{ overflowX: 'auto', my: 1.5, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 1, background: 'rgba(0,0,0,0.1)', wordBreak: 'normal' }}>
                <table style={{ borderCollapse: 'collapse', tableLayout: 'auto' }} {...props} />
            </Box>
        ),
        thead: ({ node, ...props }: { node?: any, children?: import('react').ReactNode }) => <thead style={{ background: 'rgba(0,0,0,0.2)' }} {...props} />,
        th: ({ node, ...props }: { node?: any, children?: import('react').ReactNode }) => <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.3)', textAlign: 'left', fontWeight: 'bold', whiteSpace: 'nowrap' }} {...props} />,
        td: ({ node, ...props }: { node?: any, children?: import('react').ReactNode }) => <td style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.3)', minWidth: '150px' }} {...props} />,
        code: ({ node, inline, className, children, ...props }: { node?: any, inline?: boolean, className?: string, children?: import('react').ReactNode }) => {
            if (inline) {
                return (
                    <Box
                        component="code"
                        sx={{
                            background: 'rgba(0,0,0,0.2)',
                            px: '5px',
                            py: '2px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                        }}
                        {...props}
                    >
                        {children}
                    </Box>
                );
            }

            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            const codeText = String(children).replace(/\n$/, '');

            return <CodeBlock language={language} codeText={codeText} />;
        },
    };

    // Helper to render extractedText with document dividers
    function renderExtractedText(text: string, collapsed: { [key: string]: boolean }, setCollapsed: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>) {
        // Split on file header lines: --- filename (PDF/TXT) ---
        const docRegex = /--- (.+?) \(([A-Z]+)\) ---\n/;;
        const parts = text.split(docRegex);
        // parts: [before, filename, type, docText, filename, type, docText, ...]
        const result = [];
        for (let i = 1; i < parts.length; i += 3) {
            const filename = parts[i];
            const type = parts[i + 1];
            const docText = parts[i + 2] || '';
            const key = filename + type;
            const isOpen = !collapsed[key];
            result.push(
                <Box key={key} sx={{ my: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, cursor: 'pointer' }}
                        onClick={() => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))}>
                        <ExpandMoreIcon sx={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: type === 'PDF' ? '#1976d2' : '#4b2067', fontSize: 22 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1976d2' }}>{filename} <span style={{ fontWeight: 400, color: '#555', fontSize: 14 }}>({type})</span></Typography>
                    </Box>
                    <Box sx={{ borderBottom: '2px solid #1976d2', opacity: 0.18, mb: 2 }} />
                    <Collapse in={isOpen}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#222' }}>{docText.trim()}</Typography>
                    </Collapse>
                </Box>
            );
        }
        return result;
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            position: 'relative',
            background: 'linear-gradient(120deg, #e0eafc 0%, #cfdef3 100%)',
            overflow: 'hidden',
        }}>
            {/* Blurred accent background */}
            <Box sx={{
                position: 'absolute',
                top: { xs: 40, md: 80 },
                left: { xs: -80, md: 0 },
                right: { xs: -80, md: 0 },
                mx: 'auto',
                width: { xs: '90%', md: 700 },
                height: { xs: 220, md: 320 },
                background: 'linear-gradient(135deg, #a7bfe8 0%, #f3e7e9 100%)',
                filter: 'blur(48px)',
                opacity: 0.5,
                zIndex: 0,
                borderRadius: 6,
            }} />
            <Box sx={{
                position: 'relative',
                zIndex: 1,
                maxWidth: { xs: '100%', sm: 600, md: 900 },
                mx: 'auto',
                p: { xs: 2, sm: 3, md: 4 },
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 2, sm: 3, md: 4 },
            }}>
                <Typography variant="h3" align="center" sx={{ fontWeight: 700, mb: 2, color: '#2a3659', letterSpacing: 1 }}>
                    Contract Analysis
                </Typography>
                {/* Disclaimer at the top, outside the upload panel */}
                <Box sx={{ width: '100%', mb: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: '#2a3659' }}>
                        Disclaimer
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#3a3a3a' }}>
                        This website does not provide legal advice. The document analysis tool is best effort and may not be accurate. We accept no liability; this website is no substitute for professional legal advice. Please consult a qualified attorney for legal matters.
                    </Typography>
                </Box>
                {/* Show document upload UI if no document is selected */}
                {!extractedText && (
                    <Paper
                        elevation={8}
                        sx={{
                            p: 3,
                            mb: 3,
                            borderRadius: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            background: 'rgba(255,255,255,0.92)',
                            boxShadow: '0 8px 32px 0 rgba(60,60,120,0.12)',
                            border: dragActive ? '2px dashed #4f8edc' : '2px solid transparent',
                            transition: 'border 0.2s',
                            cursor: filesLocked ? 'not-allowed' : 'pointer',
                            opacity: filesLocked ? 0.7 : 1
                        }}
                        onDragEnter={filesLocked ? undefined : handleDrag}
                        onDragOver={filesLocked ? undefined : handleDrag}
                        onDragLeave={filesLocked ? undefined : handleDrag}
                        onDrop={filesLocked ? undefined : handleDrop}
                    >
                        <InsertDriveFileIcon sx={{ fontSize: 48, color: dragActive ? '#1976d2' : '#4f8edc', mb: 1, transition: 'color 0.2s' }} />
                        {(!filesLocked) && (
                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: '#2a3659' }}>
                                Upload Document(s)
                            </Typography>
                        )}
                        {selectedFiles.length === 0 && !filesLocked ? (
                            <Button variant="contained" component="label" sx={{ fontWeight: 600, px: 4, py: 1.5, background: 'linear-gradient(135deg, #2d2e6e 0%, #4b2067 50%, #1b1b3a 100%)', color: '#fff', boxShadow: '0 2px 12px 0 rgba(44,0,80,0.18)', '&:hover': { background: 'linear-gradient(135deg, #3a2067 0%, #2d2e6e 100%)' }, '&.Mui-disabled': { color: '#b0b0c0' } }} disabled={filesLocked}>
                                Select Document Files
                                <input type="file" accept=".pdf,.md,text/*" multiple hidden onChange={handleFileChange} disabled={filesLocked} />
                            </Button>
                        ) : null}
                        {selectedFiles.length > 0 && !filesLocked ? (
                            <Button variant="outlined" component="label" sx={{ fontWeight: 500, px: 2, py: 0.5, minWidth: 0, fontSize: 14, mb: 1, background: 'linear-gradient(135deg, #2d2e6e 0%, #4b2067 50%, #1b1b3a 100%)', color: '#fff', border: 'none', boxShadow: '0 2px 12px 0 rgba(44,0,80,0.18)', '&:hover': { background: 'linear-gradient(135deg, #3a2067 0%, #2d2e6e 100%)' }, '&.Mui-disabled': { color: '#b0b0c0' } }} disabled={filesLocked}>
                                Add files
                                <input type="file" accept=".pdf,.md,text/*" multiple hidden onChange={handleFileChange} disabled={filesLocked} />
                            </Button>
                        ) : null}
                        <Typography variant="caption" sx={{ mt: 1, color: dragActive ? '#1976d2' : '#555', fontWeight: dragActive ? 600 : 400 }}>
                            {filesLocked ? 'Files are now locked for this session.' : dragActive ? 'Drop files here!' : selectedFiles.length === 0 ? 'Drag & drop PDF or text files here, or click to select. Multiple files allowed.' : 'You can add more files or remove existing ones.'}
                        </Typography>
                        {selectedFiles.length > 0 && (
                            <List sx={{ width: '100%', mt: 2 }}>
                                {selectedFiles.map((file, idx) => (
                                    <ListItem
                                        key={idx}
                                        secondaryAction={
                                            !filesLocked && <IconButton edge="end" aria-label="remove" onClick={() => handleRemoveFile(idx)}>
                                                <CloseIcon sx={{ color: '#888' }} />
                                            </IconButton>
                                        }
                                    >
                                        <ListItemIcon>
                                            <InsertDriveFileIcon sx={{ color: '#4f8edc' }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={<Typography sx={{ color: '#222', fontWeight: 500 }}>{file.name}</Typography>}
                                            secondary={<Typography sx={{ color: '#444' }}>{(file.size / 1024).toFixed(1)} KB</Typography>}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                        {selectedFiles.length > 1 && !filesLocked && (
                            <Button variant="text" color="error" onClick={handleClearAll} sx={{ mt: 1 }}>
                                Clear All
                            </Button>
                        )}
                    </Paper>
                )}
                {/* Only show chat and analysis UI after document is selected and WebSocket is connected */}
                {extractedText && wsConnected && (
                    <>
                        {/* Floating chat messages area */}
                        <Box sx={{
                            mb: 3,
                            px: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            background: 'transparent',
                            borderRadius: 0,
                            boxShadow: 'none',
                            position: 'relative',
                        }}>
                            {/* Collapsible extracted text message */}
                            {extractedText && (
                                <Paper elevation={2} sx={{ mb: 1, background: 'rgba(79,142,220,0.08)', borderRadius: 2, p: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowExtracted(v => !v)}>
                                        <ExpandMoreIcon sx={{ transform: showExtracted ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                        <Typography sx={{ fontWeight: 600, color: '#1976d2', ml: 1 }}>Extracted PDF/Text</Typography>
                                    </Box>
                                    <Collapse in={showExtracted}>
                                        {extractedText && renderExtractedText(extractedText, collapsedDocs, setCollapsedDocs)}
                                    </Collapse>
                                </Paper>
                            )}
                            {messages.map((msgObj, idx) => {
                                const isUser = msgObj.sender === 'user';
                                return (
                                    <Box key={idx} sx={{
                                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                                        background: 'linear-gradient(135deg, #4f8edc 0%, #1976d2 100%)',
                                        color: '#fff',
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2,
                                        minWidth: isUser ? '0' : '90%',
                                        maxWidth: isUser ? '80%' : '94%',
                                        boxShadow: '0 2px 12px 0 rgba(44,0,80,0.18)',
                                        fontWeight: 500,
                                        letterSpacing: 0.2,
                                        border: 'none',
                                        outline: 'none',
                                        cursor: 'default',
                                        wordBreak: 'break-word',
                                    }}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={markdownComponents}
                                        >{msgObj.text}</ReactMarkdown>
                                    </Box>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </Box>
                    </>
                )}
                {/* WebSocket connection status and error display (top of main content) */}
                {(!wsConnecting && !wsConnected && failureMessage) && (
                    <Box sx={{ mb: 3 }}>
                        <Paper elevation={6} sx={{ p: 3, background: '#fff3e0', border: '1px solid #ffa726', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h6" sx={{ color: '#d84315', fontWeight: 700, mb: 1 }}>
                                {failureMessage || 'Unable to connect to the server. Please try again later.'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#d84315', mb: 2 }}>
                                Reloading will lose all chat and file context.
                            </Typography>
                            <Button
                                variant="contained"
                                color="error"
                                sx={{ fontWeight: 700, px: 4, py: 1.5, borderRadius: 2 }}
                                onClick={() => window.location.reload()}
                            >
                                Reload Page
                            </Button>
                        </Paper>
                    </Box>
                )}
                {/* Chat input and send button: show if files are selected and not locked, or after document is extracted and wsConnected */}
                {((selectedFiles.length > 0 && !filesLocked) || (extractedText && wsConnected)) && (
                    <Paper elevation={4} sx={{ p: 3, mb: 3, borderRadius: 4, background: 'rgba(255,255,255,0.97)', boxShadow: '0 4px 16px 0 rgba(60,60,120,0.08)', position: 'relative', overflow: 'visible' }}>
                        {/* Prompt suggestion chips below chat input */}
                        {promptChips.length > 0 && !isWaitingForResponse && (
                            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {promptChips.map((chip) => (
                                    <Button
                                        key={chip.label}
                                        variant="outlined"
                                        size="small"
                                        sx={{ fontWeight: 500, borderRadius: 2, color: '#2d2e6e', borderColor: '#4b2067', background: 'rgba(44,0,80,0.04)', '&:hover': { background: 'rgba(44,0,80,0.12)' } }}
                                        onClick={() => handlePromptChipClick(chip.label, chip.text)}
                                    >
                                        {chip.label}
                                    </Button>
                                ))}
                            </Box>
                        )}
                        {/* Accent beside chatbox */}
                        <Box sx={{
                            position: 'absolute',
                            right: -32,
                            top: 24,
                            bottom: 24,
                            width: 32,
                            borderRadius: '32px',
                            background: 'linear-gradient(180deg, #e0eafc 0%, #a7bfe8 100%)',
                            filter: 'blur(8px)',
                            opacity: 0.7,
                            zIndex: 0,
                            display: { xs: 'none', sm: 'block' }
                        }} />
                        {isWaitingForResponse ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 2, width: '100%' }}>
                                <Typography variant="body1" sx={{ color: '#1976d2', fontWeight: 600 }}>
                                    {waitingMessage}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <CircularProgress size={28} thickness={5} sx={{ color: '#1976d2' }} />
                                </Box>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, position: 'relative', zIndex: 1 }}>
                                <TextField
                                    label="Ask about your document(s)"
                                    multiline
                                    minRows={1}
                                    maxRows={8}
                                    fullWidth
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder="Type your question about the document(s)..."
                                    sx={{ mb: 0, background: '#f7f7fa', borderRadius: 2, '& .MuiInputBase-root': { minHeight: '56px', alignItems: 'center' }, '& .MuiInputBase-input': { color: '#222', fontSize: 16, fontWeight: 500, py: 0 } }}
                                    InputLabelProps={{ style: { color: '#2a3659' } }}
                                    disabled={filesLocked && selectedFiles.length === 0 || isWaitingForResponse}
                                    error={!!inputError}
                                    helperText={inputError}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                />
                                <Button
                                    variant="contained"
                                    color="primary"
                                    sx={{ mb: 0, ml: 1, px: 2.5, height: 56, alignSelf: 'flex-end', fontWeight: 600, fontSize: 16, borderRadius: 2, boxShadow: '0 2px 12px 0 rgba(44,0,80,0.18)', background: 'linear-gradient(135deg, #2d2e6e 0%, #4b2067 50%, #1b1b3a 100%)', color: '#fff', '&:hover': { background: 'linear-gradient(135deg, #3a2067 0%, #2d2e6e 100%)' }, '&.Mui-disabled': { color: '#b0b0c0' } }}
                                    disabled={!input.trim() || (filesLocked && selectedFiles.length === 0) || (messages.length === 0 && selectedFiles.length === 0)}
                                    onClick={handleSendMessage}
                                    aria-label="Send"
                                    endIcon={<SendIcon sx={{ fontSize: 32 }} />}
                                >
                                    Send
                                </Button>
                            </Box>
                        )}
                    </Paper>
                )}
                {/* Links to About, Privacy, and Terms of Service modals (moved outside message box) */}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button variant="text" size="small" sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 500 }} onClick={() => handleOpenModal('about')}>
                        About
                    </Button>
                    <Button variant="text" size="small" sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 500 }} onClick={() => handleOpenModal('privacy')}>
                        Privacy
                    </Button>
                    <Button variant="text" size="small" sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 500 }} onClick={() => handleOpenModal('tos')}>
                        Terms of Service
                    </Button>
                    <Button
                        variant="text"
                        size="small"
                        sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 500 }}
                        onClick={() => window.open('https://hyperkube.org', '_blank')}
                    >
                        Need a custom chat tool?
                    </Button>
                </Box>
                {/* Modal for About, Privacy, Terms of Service */}
                <Dialog open={modalOpen !== null} onClose={handleCloseModal} maxWidth="md" fullWidth>
                    <DialogContent dividers sx={{ background: '#fff', color: '#000', position: 'relative' }}>
                        <IconButton
                            aria-label="close"
                            onClick={handleCloseModal}
                            sx={{
                                position: 'absolute',
                                right: 8,
                                top: 8,
                                color: (theme) => theme.palette.grey[500],
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                        {modalContent && (
                            <Box sx={{ mt: 4, mb: 2 }}>
                                <ReactMarkdown
                                    components={{
                                        a: ({ children, href }: { children?: import('react').ReactNode, href?: string }) => <Button variant="text" size="small" sx={{ color: '#1976d2', textTransform: 'none', fontWeight: 500, p: 0 }} onClick={() => { if (href) window.open(href, '_blank'); }}>{children}</Button>,
                                    }}
                                >
                                    {modalContent}
                                </ReactMarkdown>
                            </Box>
                        )}
                    </DialogContent>
                </Dialog>
            </Box>
            {/* Scroll to bottom bubble */}
            {showScrollBubble && messages.length > 0 && (
                <Box sx={{ position: 'fixed', right: 32, bottom: 104, zIndex: 1000, display: { xs: 'none', sm: 'block' } }}>
                    <Button
                        variant="contained"
                        sx={{
                            minWidth: 0,
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1976d2 0%, #4f8edc 100%)',
                            color: '#fff',
                            boxShadow: '0 4px 16px 0 rgba(44,80,120,0.18)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 0,
                            '&:hover': { background: 'linear-gradient(135deg, #4f8edc 0%, #1976d2 100%)' }
                        }}
                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                        aria-label="Scroll to bottom"
                    >
                        <KeyboardArrowDownIcon sx={{ fontSize: 36 }} />
                    </Button>
                </Box>
            )}
        </Box>
    );
}
