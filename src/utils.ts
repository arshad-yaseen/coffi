import stripJsonComments from "strip-json-comments";

export function cleanJson(json: string) {
    // Remove comments and normalize JSON to be parseable
    const stripped = stripJsonComments(json);

    // Fix trailing commas and other syntax issues that would cause JSON.parse to fail
    return stripped
        .replace(/,\s*([}\]])/g, "$1") // Remove trailing commas in objects and arrays
        .trim();
}
