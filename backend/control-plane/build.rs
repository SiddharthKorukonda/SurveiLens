fn main() {
    tonic_build::configure()
        .build_server(false) // control-plane = client only
        .compile_protos(&["proto/pipeline.proto"], &["proto"])
        .expect("compile protos");
    println!("cargo:rerun-if-changed=proto/pipeline.proto");
}
