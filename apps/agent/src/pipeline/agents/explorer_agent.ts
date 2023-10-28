import { AgentExecutor, OpenAIAgent } from "langchain/agents";
import { LLMChain } from "langchain/chains";
import { AIMessage, FunctionMessage } from "langchain/schema";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { RepositoryWalker } from "~/lib/github/repository";
import { chatOpenAi } from "~/lib/openai";
import { ListFilesTool } from "../tools/list_files";
import ReadFileTool from "../tools/read_file";
import SaveAnalysisTool from "../tools/save_analysis";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { env } from "~/env";

/***
 * Create an agent to solve a specific agent
 */
export async function createExplorerAgentExecutor(
  walker: RepositoryWalker,
  prompt: string
): Promise<AgentExecutor> {
  // Repository exploration tools
  const listFilesTool = new ListFilesTool(walker);
  const tools = [
    listFilesTool,
    new ReadFileTool(walker),
    new SaveAnalysisTool(),
  ];

  // Prompt
  const seedFiles = await listFilesTool.call({ directory: "" });
  const promptTemplate = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(prompt),
    new AIMessage({
      content: "",
      additional_kwargs: {
        function_call: {
          name: listFilesTool.name,
          arguments: JSON.stringify({ directory: "" }),
        },
      },
    }),
    new FunctionMessage(seedFiles, listFilesTool.name),
    new MessagesPlaceholder("chat_history"),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  // Executors
  const chain = new LLMChain({
    prompt: promptTemplate,
    llm: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      openAIApiKey: env.OPENAI_API_KEY,
      temperature: 0.1,
    }),
  });
  const agent = new OpenAIAgent({
    llmChain: chain,
    allowedTools: tools.map((tool) => tool.name),
    tools,
  });

  return new AgentExecutor({
    agent,
    tools,
    verbose: true,
  });
}
