export class FormFieldError extends Error {
  loc: string

  constructor(message: string, loc: string) {
    super(message)
    this.name = "FormFieldError"
    this.loc = loc
    this.message = message
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FormFieldError)
    }
  }
}

export class ApiError extends Error {
  status: number
  statusText: string

  constructor(message: string, status: number, statusText: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.statusText = statusText
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError)
    }
  }
}

export async function parseErrorResponse(response: Response): Promise<Error> {
  const contentType = response.headers.get("content-type")
  const isJson = contentType?.includes("application/json")

  if (!isJson) {
    const text = await response.text()
    return new ApiError(
      text || `${response.status} ${response.statusText}`,
      response.status,
      response.statusText,
    )
  }

  try {
    const errorData = await response.json()

    if (errorData.detail.type === "FormFieldError") {
      const message = errorData.detail.message
      const loc = errorData.detail.loc

      return new FormFieldError(message, loc)
    }

    // Fallback for other JSON error formats
    const message = JSON.stringify(errorData)
    return new ApiError(message, response.status, response.statusText)
  } catch {
    return new ApiError(
      `${response.status} ${response.statusText}`,
      response.status,
      response.statusText,
    )
  }
}
