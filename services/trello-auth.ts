export async function getTrelloToken(): Promise<string> {
    const token = process.env.TRELLO_TOKEN;
    if (!token) throw new Error("No token found in env");
    return token;
}