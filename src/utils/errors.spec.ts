import { EscapedError, htmlSafe } from "./errors";

describe("Errors test", () => {
  test("htmlSafe fn", () => {
    const input = `
        <h3>Features:</h3>
        <ul>
          <li>Specifies HTML tags and their attributes allowed with whitelist</li>
          <li>Handle any tags or attributes using custom function</li>
        </ul>
        <script type="text/javascript">
        alert(/xss/);
        </script>`;
    const output = `
        &lt;h3&gt;Features:&lt;/h3&gt;
        &lt;ul&gt;
          &lt;li&gt;Specifies HTML tags and their attributes allowed with whitelist&lt;/li&gt;
          &lt;li&gt;Handle any tags or attributes using custom function&lt;/li&gt;
        &lt;/ul&gt;
        &lt;script type=&quot;text/javascript&quot;&gt;
        alert(/xss/);
        &lt;/script&gt;`;

    expect(htmlSafe(input)).toBe(output);
  });

  test("EscapedError", () => {
    const err = new EscapedError(`Please show me this error in input <script type="text/javascript">alert(/xss/)</script>.`)
    expect(err.message).toBe(`Please show me this error in input &lt;script type=&quot;text/javascript&quot;&gt;alert(/xss/)&lt;/script&gt;.`)
  })
});
