import { createFileRoute } from "@tanstack/react-router";
import { SongCategoryList } from "../../components/SongCategoryList";

export const Route = createFileRoute("/books/song-book/additional")({
  head: () => ({
    meta: [
      { title: "Additional Songs — Church Companion" },
      { name: "description", content: "Browse and read the Additional Songs collection." },
      { property: "og:title", content: "Additional Songs" },
      { property: "og:description", content: "Browse and read the Additional Songs collection." },
    ],
  }),
  component: () => <SongCategoryList category="additional" />,
});
