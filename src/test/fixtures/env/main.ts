
// Here a Fibonacci sequence function
export function fib(n: number): number {
	if (n <= 1) return n;
	return fib(n - 1) + fib(n - 2);
}