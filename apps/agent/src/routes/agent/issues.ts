import { prisma } from "database";
import { Context, Next } from "koa";
import { z } from "zod";
import APIError from "~/lib/api_error";
import { getGithubInstallationClient } from "~/lib/github";
import GithubRepositoryClient from "~/lib/github/repository_client";
import { identifyDirectories } from "~/pipelines/identify_directories";
import { identifyTheme } from "~/pipelines/identify_theme";

const bodySchema = z.object({
  repo: z.string(),
});

/**
 * Scan issues in a repository and attempt to solve them
 */
export default async function scanIssues(ctx: Context, next: Next) {
  const { repo: fullName } = bodySchema.parse(ctx.request.body);

  const repository = await prisma.repository.findUnique({
    where: { fullName },
  });
  if (!repository) {
    throw new APIError({
      type: "NOT_FOUND",
      message: `Repository '${fullName}' not yet registered. Have you installed the app on your repository/organization?`,
    });
  }

  const client = await getGithubInstallationClient(repository.installationId);
  const repositoryClient = new GithubRepositoryClient(client, repository);
  const issues = await repositoryClient.getIssues();

  ctx.status = 200;
  ctx.body = issues;
  return next();
}