import { Repository, prisma } from "database";
import { z } from "zod";
import { getGithubInstallationClient } from "~/lib/github";
import { RepositoryWalker } from "~/lib/github/repository";
import { createExplorerAgentExecutor } from "../agents/explorer_agent";
import { AIMessage, FunctionMessage } from "langchain/schema";
import { objectiveSchema as identifyDirectoriesSchema } from "./identify_directories";
import { ListFilesTool } from "~/tools/list_files";

const prompt = `You are an expert frontend web developer. You have already identified what directories you need to modify to \
create new pages, components, and styles. Your next task is to identify the theme and design language of the existing project. \
Explore the repository by sampling a few pages and components to identify the theme and design language. Be thorough and also \
check out any relevant config or global CSS files.

Always call the provided functions to either submit your analysis or request more information.`;

const fontSchema = z.object({
  fontFace: z.string().describe("The font face used"),
  fontSize: z.string().describe("The font size used, with corresponding units"),
});

const objectiveSchema = z.object({
  font: z.object({
    heading: fontSchema.describe("The font used for headings"),
    subheading: fontSchema.describe("The font used for subheadings"),
    body: fontSchema.describe("The font used for body text"),
    subtitle: fontSchema.describe("The font used for subtitles"),
  }),
  colors: z.object({
    primary: z.string().describe("The primary color, in hex"),
    secondary: z.string().describe("The secondary color, in hex"),
  }),
});

const objectiveDescription =
  "Identify the design language being used in the project";

/**
 * Identify the theme and design language of the project
 */
export async function identifyTheme(repository: Repository) {
  const installationClient = getGithubInstallationClient(
    repository.installationId
  );
  const [owner, repo] = repository.fullName.split("/");
  const walker = new RepositoryWalker(installationClient, owner, repo);

  const explorer = await createExplorerAgentExecutor(
    walker,
    prompt,
    objectiveSchema,
    objectiveDescription
  );

  const repositoryAnalysis = identifyDirectoriesSchema.parse(
    repository.analysis
  );
  const labeledRepositoryAnalysis = {} as Record<string, any>;
  const directoryKeys = Object.keys(identifyDirectoriesSchema.shape) as Array<
    keyof typeof identifyDirectoriesSchema.shape
  >;
  for (const key of directoryKeys) {
    labeledRepositoryAnalysis[key] = {
      path: repositoryAnalysis[key],
      description: identifyDirectoriesSchema.shape[key].description,
    };
  }

  const listFilesTool = new ListFilesTool(walker);
  const seedFiles = await listFilesTool.call({ directory: "" });
  const result = await explorer.call({
    input: "",
    chat_history: [
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
      new AIMessage({
        content: "",
        additional_kwargs: {
          function_call: {
            name: "identify_directories",
            arguments: "",
          },
        },
      }),
      new FunctionMessage({
        name: "identify_directories",
        content: JSON.stringify(labeledRepositoryAnalysis),
      }),
    ],
  });

  const analysis = objectiveSchema.parse(JSON.parse(result.output));
  // await prisma.repository.update({
  //   where: { id: repository.id },
  //   data: {
  //     analysis,
  //   },
  // });

  return analysis;
}
