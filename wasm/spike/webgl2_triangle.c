/* Phase-0 compat spike: SDL2 window + WebGL2/GLES3 context + a #version 300 es
 * shader drawing a colored triangle, driven by emscripten_set_main_loop.
 * Proves emcc + sdl2 port + WebGL2 + GLSL-ES-300 + the serve/chrome harness
 * all work end-to-end, exactly the pieces the real game boot depends on. */
#include <SDL2/SDL.h>
#include <GLES3/gl3.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <stdio.h>
#include <stdlib.h>

static GLuint prog;
static GLuint vao, vbo;
static float t = 0.0f;

static GLuint compile(GLenum type, const char *src) {
  GLuint s = glCreateShader(type);
  glShaderSource(s, 1, &src, NULL);
  glCompileShader(s);
  GLint ok = 0;
  glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    char log[1024];
    glGetShaderInfoLog(s, sizeof(log), NULL, log);
    printf("shader compile FAILED: %s\n", log);
  } else {
    printf("shader compile ok (%s)\n", type == GL_VERTEX_SHADER ? "vs" : "fs");
  }
  return s;
}

static const char *VS =
  "#version 300 es\n"
  "layout(location=0) in vec2 pos;\n"
  "layout(location=1) in vec3 col;\n"
  "out vec3 vcol;\n"
  "uniform float u_t;\n"
  "void main(){ float c=cos(u_t),s=sin(u_t);\n"
  "  gl_Position=vec4(mat2(c,-s,s,c)*pos,0.0,1.0); vcol=col; }\n";

static const char *FS =
  "#version 300 es\n"
  "precision highp float;\n"
  "in vec3 vcol; out vec4 frag;\n"
  "void main(){ frag=vec4(vcol,1.0); }\n";

static void frame(void) {
  t += 0.02f;
  int w, h;
  emscripten_get_canvas_element_size("#canvas", &w, &h);
  glViewport(0, 0, w, h);
  glClearColor(0.06f, 0.10f, 0.16f, 1.0f);
  glClear(GL_COLOR_BUFFER_BIT);
  glUseProgram(prog);
  glUniform1f(glGetUniformLocation(prog, "u_t"), t);
  glBindVertexArray(vao);
  glDrawArrays(GL_TRIANGLES, 0, 3);
}

int main(void) {
  printf("spike: SDL_Init\n");
  if (SDL_Init(SDL_INIT_VIDEO) != 0) { printf("SDL_Init failed: %s\n", SDL_GetError()); return 1; }
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 0);
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_ES);
  SDL_Window *win = SDL_CreateWindow("spike", 0, 0, 1280, 720, SDL_WINDOW_OPENGL);
  if (!win) { printf("CreateWindow failed: %s\n", SDL_GetError()); return 1; }
  SDL_GLContext ctx = SDL_GL_CreateContext(win);
  if (!ctx) { printf("GL_CreateContext failed: %s\n", SDL_GetError()); return 1; }
  printf("GL_VERSION: %s\n", (const char *)glGetString(GL_VERSION));
  printf("GL_VENDOR:  %s\n", (const char *)glGetString(GL_VENDOR));

  prog = glCreateProgram();
  glAttachShader(prog, compile(GL_VERTEX_SHADER, VS));
  glAttachShader(prog, compile(GL_FRAGMENT_SHADER, FS));
  glLinkProgram(prog);
  GLint ok = 0; glGetProgramiv(prog, GL_LINK_STATUS, &ok);
  printf("program link %s\n", ok ? "ok" : "FAILED");

  float verts[] = {
    /* pos */  0.0f,  0.6f,  /* col */ 1.0f, 0.3f, 0.3f,
              -0.6f, -0.5f,             0.3f, 1.0f, 0.4f,
               0.6f, -0.5f,             0.4f, 0.5f, 1.0f };
  glGenVertexArrays(1, &vao);
  glBindVertexArray(vao);
  glGenBuffers(1, &vbo);
  glBindBuffer(GL_ARRAY_BUFFER, vbo);
  glBufferData(GL_ARRAY_BUFFER, sizeof(verts), verts, GL_STATIC_DRAW);
  glEnableVertexAttribArray(0);
  glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void *)0);
  glEnableVertexAttribArray(1);
  glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void *)(2 * sizeof(float)));

  printf("spike: entering main loop\n");
  emscripten_set_main_loop(frame, 0, 1);
  return 0;
}
