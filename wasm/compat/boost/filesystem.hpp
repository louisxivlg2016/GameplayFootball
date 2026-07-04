#pragma once
// wasm shim shadowing <boost/filesystem.hpp>. The code's usage (path, exists,
// is_directory, directory_iterator, create_directory, copy_file, path ops,
// boost::system::error_code) maps 1:1 onto std::filesystem (C++17). std has
// everything the game calls, so this is mostly a namespace alias.
#include <filesystem>
#include <system_error>

namespace boost {
namespace system {
  // the game uses .value() and `if (error)` — std::error_code has both
  using error_code = std::error_code;
}
namespace filesystem {
  using namespace std::filesystem;
  // std::filesystem::copy_file with default options fails if the target exists;
  // the game copies into fresh dests, but overwrite is friendlier for re-runs.
  inline void copy_file(const path &from, const path &to, std::error_code &ec) noexcept {
    std::filesystem::copy_file(from, to, std::filesystem::copy_options::overwrite_existing, ec);
  }
  inline bool copy_file(const path &from, const path &to) {
    std::error_code ec;
    return std::filesystem::copy_file(from, to, std::filesystem::copy_options::overwrite_existing, ec);
  }
  // boost's system_complete → std::filesystem::absolute (make path absolute)
  inline path system_complete(const path &p) {
    std::error_code ec;
    path a = std::filesystem::absolute(p, ec);
    return ec ? p : a;
  }
}  // namespace filesystem
}  // namespace boost
