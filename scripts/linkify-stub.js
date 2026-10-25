// markdown-it constructs a LinkifyIt even with linkify off; talkdown never enables it.
export class LinkifyIt { test() { return false; } match() { return null; } matchAtStart() { return null; } pretest() { return false; } }
