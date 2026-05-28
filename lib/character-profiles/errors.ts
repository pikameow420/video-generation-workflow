export class AnchorReferenceNotFoundError extends Error {
  constructor(
    message = "One or more anchor reference images could not be found.",
  ) {
    super(message);
    this.name = "AnchorReferenceNotFoundError";
  }
}
