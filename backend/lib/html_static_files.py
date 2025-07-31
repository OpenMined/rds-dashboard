from fastapi.staticfiles import StaticFiles


class HTMLStaticFiles(StaticFiles):
    def lookup_path(self, path):
        full_path, stat = super().lookup_path(path)

        # also check .html file extensions for routes
        if not stat and self.html and path and "." not in path:
            return super().lookup_path(f"{path}.html")

        return full_path, stat
