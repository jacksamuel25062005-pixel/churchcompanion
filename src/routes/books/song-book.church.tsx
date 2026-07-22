import { createFileRoute } from "@tanstack/react-router";
import { SongCategoryList } from "../../components/SongCategoryList";

export const Route = createFileRoute("/books/song-book/church")({
  head: () => ({
    meta: [
      { title: "Church Song Book — Church Companion" },
      { name: "description", content: "Browse and read songs from the Church Song Book." },
      { property: "og:title", content: "Church Song Book" },
      { property: "og:description", content: "Browse and read songs from the Church Song Book." },
    ],
  }),
  component: () => <SongCategoryList category="church" />,
});
