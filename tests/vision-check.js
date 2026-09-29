const assert = require("node:assert/strict");
const v = require("../web/js/vision-core.js");
assert.equal(
  v.endpoint("https://example.com/v1/"),
  "https://example.com/v1/chat/completions",
);
assert.equal(
  v.endpoint("https://example.com/chat/completions"),
  "https://example.com/chat/completions",
);
for (const url of [
  "http://example.com",
  "https://user:pass@example.com",
  "https://example.com?key=x",
])
  assert.throws(() => v.endpoint(url));
assert.throws(() => v.request("test", "file:///private/image.jpg"));
const body = v.request("test", "data:image/jpeg;base64,YQ==");
assert.equal(body.messages.length, 1);
assert.equal(body.messages[0].content[1].type, "image_url");
const content = {
  foods: [{ name: "苹果", portion: "一个", calories: 95, grams: 182 }],
  notes: "估算",
};
assert.equal(
  v.parse({
    choices: [
      { message: { content: "```json\n" + JSON.stringify(content) + "\n```" } },
    ],
  }).foods[0].calories,
  95,
);
assert.equal(v.parse({ foods: [] }).foods.length, 0);
for (const result of [
  null,
  {},
  { foods: [null] },
  { foods: [{ name: "a", calories: "95" }] },
  { foods: [{ name: "a", calories: -1 }] },
  { foods: Array(13).fill(content.foods[0]) },
])
  assert.throws(() => v.parse(result));
assert.throws(() =>
  v.parse({ choices: [{ message: { content: "not json" } }] }),
);
console.log("Vision protocol and validation checks passed");
