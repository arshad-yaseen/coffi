export default async function () {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
        name: "async",
    };
}
