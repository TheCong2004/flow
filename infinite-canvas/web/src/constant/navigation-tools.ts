import { FileText, ImagePlus, Images, Maximize2, Video } from "lucide-react";

export const navigationTools = [
    {
        slug: "canvas",
        label: "Canvas của tôi",
        icon: Maximize2,
    },
    {
        slug: "image",
        label: "Tạo ảnh",
        icon: ImagePlus,
    },
    {
        slug: "video",
        label: "Tạo video",
        icon: Video,
    },
    {
        slug: "prompts",
        label: "Thư viện prompt",
        icon: FileText,
    },
    {
        slug: "assets",
        label: "Tài nguyên của tôi",
        icon: Images,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];
