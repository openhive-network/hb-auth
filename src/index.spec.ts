interface IObj {
    a: number;
    b: number;
}

test("a to b", () => {
    const obj: IObj = {
        a: 1,
        b: 1
    }

    expect(obj.a).toBe(obj.b)
})