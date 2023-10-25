import { z } from "zod";
import Tool from "./tool";

const name = "read_file";
const description = "Read a file";
const parameterSchema = z.object({
  path: z.string().describe("The path of the file to read"),
});
const resultSchema = z.string();

export default class ReadFileTool extends Tool<
  typeof name,
  typeof description,
  typeof parameterSchema,
  typeof resultSchema
> {
  constructor() {
    super(name, description, parameterSchema, resultSchema);
  }
}