import { ReactElement, useRef } from "react";
import { useForm } from "react-hook-form";
import { ConfigSchema } from "../App";
import Message from "./Message";
import { useAppState } from "../store";

type ConfigPayload = {
  configFile?: FileList;
};
interface UploadProps {
  content: string | ReactElement;
}
const Upload = ({ content }: UploadProps) => {
  const { register, handleSubmit, setValue } = useForm<ConfigPayload>();
  const form = useRef<HTMLFormElement>(null);
  const refresh = useAppState(state => state.refresh)

  const onSubmit = (payload: ConfigPayload) => {
    const fd = new FileReader();
    if(!payload?.configFile) return
    fd.readAsText(payload.configFile?.[0], "utf-8");
    fd.onloadend = (e) => {
      try {
        if (!chrome.storage) throw Error('Not In Chrome Extension.');
        const data = (e.target?.result ?? "[]") as string;
        const tabData = JSON.parse(data);
        ConfigSchema.parse(tabData);
        chrome.storage.local.set({ tabData: tabData });
        refresh()
        Message.show("Success")
        setValue("configFile",undefined)
      } catch (error) {
        Message.show(String(error), {danger: true})
        setValue("configFile", undefined)
      }
    };
  };

  return (
    <div className="">
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(onSubmit)(e);
        }}
      >
        <label className="inline-block" htmlFor="configFile">
          <div
            tabIndex={0}
            className="bg-transparent text-black-700 border border-transparent hover:bg-black-50 focus:ring-2 focus:ring-black-500 focus:ring-offset-2 transition-colors duration-200  px-3 py-1.5 text-sm rounded-lg"
          >
            {content ?? "Upload"}
          </div>
        </label>
        <input
          {...register("configFile", {
            required: true,
            onChange: () => {
              form.current?.requestSubmit();
            },
          })}
          id="configFile"
          type="file"
          accept=".json"
          className="hidden"
        />
      </form>
    </div>
  );
};

export default Upload;
