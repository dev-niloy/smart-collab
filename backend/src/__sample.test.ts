describe('backend toolchain smoke', () => {
  it('runs jest under ts-jest', () => {
    expect(1 + 1).toBe(2);
  });

  it('has TypeScript strict mode types', () => {
    const x: number = 42;
    expect(typeof x).toBe('number');
  });
});
