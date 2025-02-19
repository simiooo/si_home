import Modal, { ModalProps } from "./Modal";
import { CardProps } from "./Card";
import Input from "./Input";
import Textarea from "./Textarea";
import { SubmitHandler, useForm } from "react-hook-form";
import { Button } from "./Button";
import { useEffect } from "react";

interface EditCardModalProps extends ModalProps {
  initialCardData?: Partial<CardProps>;
  onSubmit: SubmitHandler<Omit<CardProps, "favIconUrl">>;
}

const EditCardModal: React.FC<EditCardModalProps> = ({
  initialCardData,
  onSubmit,
  isOpen,
  title,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CardProps>({ defaultValues: initialCardData });
  useEffect(() => {
    setValue("title", initialCardData?.title ?? "");
    setValue("description", initialCardData?.description);
    setValue("href", initialCardData?.href);
  },[initialCardData]);

  return (
    <Modal 
    footer={null}
    title={title}
    isOpen={isOpen} onClose={onClose}>
      <form
        className="grid grid-cols-1 gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div>
          <label className="inline-flex mb-1">Title</label>
          <Input 
          aria-invalid={errors.title ? "true" : "false"}
          type="text" {...register("title", { required: {value: true, message: 'Title Required'}, })} />
          {errors.title && <span className="text-red-500 text-xs">{ errors.title.message}</span>}
        </div>
        <div>
          <label className="inline-flex mb-1">Description</label>
          <Textarea {...register("description", {  })} />
        </div>
        <div>
          <label className="inline-flex mb-1">Url</label>
          <Textarea {...register("href", { required: {value: true, message: 'Url Required'} })} />
          {errors.href && <span className="text-red-500 text-xs">{ errors.href.message}</span>}
        </div>
        
        <Button size="lg" type="submit">Save</Button>
      </form>
    </Modal>
  );
};

export default EditCardModal;
