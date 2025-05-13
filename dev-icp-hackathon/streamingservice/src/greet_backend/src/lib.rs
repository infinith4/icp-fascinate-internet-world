pub mod greet_backend_lib {
  ic_cdk::export_candid!();
  
  #[ic_cdk::query]
  fn greet(name: String) -> String {
      format!("Hello, {}!", name)
  }
  
}
