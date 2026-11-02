import type { TaskRepository } from "../db/repository";

export type HttpVariables = {
  repo: TaskRepository;
};

export type HttpEnv = {
  Variables: HttpVariables;
};
