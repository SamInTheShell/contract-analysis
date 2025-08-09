package backend

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var OLLAMA_MODEL = func() string {
	if model := os.Getenv("OLLAMA_MODEL"); model != "" {
		return model
	}
	return "gpt-oss:20b"
}()

var OLLAMA_ENDPOINT = func() string {
	if endpoint := os.Getenv("OLLAMA_ENDPOINT"); endpoint != "" {
		return endpoint
	}
	return "http://localhost:11434"
}()

var ollama_chat_endpoint = strings.Join([]string{OLLAMA_ENDPOINT, "api/chat"}, "/")
var ollama_show_endpoint = strings.Join([]string{OLLAMA_ENDPOINT, "api/show"}, "/")

var system_prompt = "You are an assistant that helps users analyze documents. The user has uploaded one or more documents. Use the available tools to answer the user's questions.\n" +
	// "Tool Reference:\n" +
	// "- `analyze_document_sentiments()`: Call this tool to analyze the document for potentially non-standard or risky clauses. It will return a summary of 'hotspots'.\n" +
	"Strategy:\n" +
	"1. When the user asks a question about the document (e.g., 'spot non-standard terms', 'summarize the risks'), call the `analyze_document_sentiments` tool.\n" +
	"2. Use the output of the tool to formulate your answer. The tool provides a pre-analyzed summary of potentially problematic clauses.\n" +
	"3. The user's documents are concatenated and separated by `--- filename ---`. When you find relevant information, mention the filename.\n" +
	"4. Do not ask the user to provide the text from the document.\n" +
	"All replies should be in English regardless of document text.\n" +
	"The user is aware you are not a lawyer and knows you're just an AI assistant."

var analyzeDocumentSentimentsTool = map[string]interface{}{
	"type": "function",
	"function": map[string]interface{}{
		"name":        "analyze_document_sentiments",
		"description": "Analyze the document for clauses with negative or cautionary sentiment.",
		"parameters":  map[string]interface{}{"type": "object", "properties": map[string]interface{}{}},
	},
}

func getModelContextLength(model string) int {
	showReq := map[string]interface{}{"model": model}
	showReqBytes, _ := json.Marshal(showReq)
	resp, err := http.Post(ollama_show_endpoint, "application/json", bytes.NewBuffer(showReqBytes))
	if err != nil {
		log.Printf("Error contacting Ollama /api/show: %v", err)
		return 0
	}
	respBody, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	var showResp map[string]interface{}
	json.Unmarshal(respBody, &showResp)
	modelInfo, ok := showResp["model_info"].(map[string]interface{})
	if !ok {
		log.Printf("No model_info found in Ollama /api/show response")
		return 0
	}
	for k, v := range modelInfo {
		if strings.HasSuffix(k, ".context_length") {
			if ctxLen, ok := v.(float64); ok {
				return int(ctxLen)
			}
		}
	}
	log.Printf("No context_length found in model_info")
	return 0
}

func countWordsInChatHistory(chatHistory []map[string]interface{}) int {
	count := 0
	for _, msg := range chatHistory {
		if content, ok := msg["content"].(string); ok {
			count += len(strings.Fields(content))
		}
	}
	return count
}

func DocAnalysisWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	contextLength := getModelContextLength(OLLAMA_MODEL)
	log.Printf("Model %s context length: %d", OLLAMA_MODEL, contextLength)

	_, docMsg, err := conn.ReadMessage()
	if err != nil || len(docMsg) < 20 {
		conn.WriteMessage(websocket.TextMessage, []byte("Invalid request: document data required (min 20 chars). Disconnecting."))
		conn.Close()
		return
	}

	docText := string(docMsg)
	chatHistory := []map[string]interface{}{
		{"role": "system", "content": system_prompt},
	}

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		userMsg := string(msg)
		chatHistory = append(chatHistory, map[string]interface{}{"role": "user", "content": userMsg})

		totalWords := countWordsInChatHistory(chatHistory)
		if totalWords > contextLength {
			log.Printf("WARNING: Estimated context exceeded! Total words: %d, context length: %d", totalWords, contextLength)
		}

		log.Printf("LLM generating message for user input.")

		ollamaReq := map[string]interface{}{
			"model":    OLLAMA_MODEL,
			"messages": chatHistory,
			"stream":   true,
			"tools":    []interface{}{analyzeDocumentSentimentsTool},
		}
		ollamaReqBytes, _ := json.Marshal(ollamaReq)
		log.Printf("Ollama request: %s", string(ollamaReqBytes))
		resp, err := http.Post(ollama_chat_endpoint, "application/json", bytes.NewBuffer(ollamaReqBytes))
		if err != nil {
			conn.WriteMessage(websocket.TextMessage, []byte("Error contacting LLM API."))
			continue
		}

		decoder := json.NewDecoder(resp.Body)
		var resp2 *http.Response
		defer func() {
			if resp2 != nil {
				resp2.Body.Close()
			}
		}()

	outer:
		for {
			var assistantResponse strings.Builder
			var toolCalls []interface{}

			for {
				var ollamaResp map[string]interface{}
				if err := decoder.Decode(&ollamaResp); err != nil {
					if err == io.EOF {
						break
					}
					log.Printf("Error decoding stream: %v", err)
					break outer
				}

				if msgPart, ok := ollamaResp["message"].(map[string]interface{}); ok {
					if content, ok := msgPart["content"].(string); ok {
						assistantResponse.WriteString(content)
					}
					if tc, ok := msgPart["tool_calls"].([]interface{}); ok {
						toolCalls = append(toolCalls, tc...)
					}
				}

				if done, ok := ollamaResp["done"].(bool); ok && done {
					break
				}
			}

			if assistantResponse.Len() > 0 {
				fullReply := assistantResponse.String()
				chatHistory = append(chatHistory, map[string]interface{}{"role": "assistant", "content": fullReply})
				conn.WriteMessage(websocket.TextMessage, []byte(fullReply))
			}

			if len(toolCalls) > 0 {
				log.Printf("Received tool_calls: %v", toolCalls)
				chatHistory = append(chatHistory, map[string]interface{}{"role": "assistant", "tool_calls": toolCalls})

				for _, call := range toolCalls {
					if callMap, ok := call.(map[string]interface{}); ok {
						if function, ok := callMap["function"].(map[string]interface{}); ok {
							if name, ok := function["name"].(string); ok {
								if name == "analyze_document_sentiments" {
									log.Printf("Tool 'analyze_document_sentiments' called")

									negativeKeywords := []string{"terminate for convenience", "indemnify", "liability", "waiver of claims", "liquidated damages", "default", "breach", "exclusive jurisdiction", "no-solicit", "penalty"}
									cautionKeywords := []string{"sole discretion", "best efforts", "reasonable efforts", "confidentiality", "non-disclosure", "limitation of liability", "force majeure", "assignment", "governing law"}

									var negativeFindings, cautionFindings []string

									sentences := strings.Split(docText, ".")
									for _, sentence := range sentences {
										lowerSentence := strings.ToLower(sentence)
										for _, keyword := range negativeKeywords {
											if strings.Contains(lowerSentence, keyword) {
												negativeFindings = append(negativeFindings, strings.TrimSpace(sentence)+".")
												break
											}
										}
										for _, keyword := range cautionKeywords {
											if strings.Contains(lowerSentence, keyword) {
												cautionFindings = append(cautionFindings, strings.TrimSpace(sentence)+".")
												break
											}
										}
									}

									var resultBuilder strings.Builder
									if len(negativeFindings) > 0 {
										resultBuilder.WriteString("## Potentially Negative Clauses\n")
										for _, finding := range negativeFindings {
											resultBuilder.WriteString(fmt.Sprintf("- %s\n", finding))
										}
										resultBuilder.WriteString("\n")
									}
									if len(cautionFindings) > 0 {
										resultBuilder.WriteString("## Clauses Requiring Caution\n")
										for _, finding := range cautionFindings {
											resultBuilder.WriteString(fmt.Sprintf("- %s\n", finding))
										}
										resultBuilder.WriteString("\n")
									}

									resultText := resultBuilder.String()
									if resultText == "" {
										resultText = "No specific clauses matching negative or cautionary keywords were found."
									}

									toolResultMsg := map[string]interface{}{
										"role":      "tool",
										"content":   resultText,
										"tool_name": name,
									}
									chatHistory = append(chatHistory, toolResultMsg)
								}
							}
						}
					}
				}

				newOllamaReq := map[string]interface{}{
					"model":    OLLAMA_MODEL,
					"messages": chatHistory,
					"stream":   true,
					"tools":    []interface{}{analyzeDocumentSentimentsTool},
				}
				newOllamaReqBytes, _ := json.Marshal(newOllamaReq)
				log.Printf("Ollama request (after tool call): %s", string(newOllamaReqBytes))
				resp.Body.Close()
				resp2, err = http.Post(ollama_chat_endpoint, "application/json", bytes.NewBuffer(newOllamaReqBytes))
				if err != nil {
					conn.WriteMessage(websocket.TextMessage, []byte("Error contacting LLM API after tool call."))
					break outer
				}
				decoder = json.NewDecoder(resp2.Body)
				resp = resp2
				continue
			}

			break
		}
		resp.Body.Close()
	}
}

// Helper function for log formatting
func logMessage(v interface{}) string {
	return fmt.Sprintf("%v", v)
}
