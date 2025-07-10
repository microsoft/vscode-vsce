// Simple Rust program that prints the first 10 Fibonacci numbers using a recursive function

/// Computes the nth Fibonacci number recursively
/// F(0) = 0, F(1) = 1, F(n) = F(n-1) + F(n-2) for n > 1
fn fibonacci(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn main() {
    println!("First 10 Fibonacci numbers:");
    for i in 0..10 {
        println!("Fibonacci({}) = {}", i, fibonacci(i));
    }
}